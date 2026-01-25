#!/usr/bin/env bash
# Usage: ./ralph.sh [--provider claude|codex] [--model opus|sonnet|haiku] [plan] [max_iterations]
# Examples:
#   ./ralph.sh                      # Claude opus, build mode, unlimited
#   ./ralph.sh 20                   # Claude opus, build mode, max 20 iterations
#   ./ralph.sh plan                 # Claude opus, plan mode, unlimited
#   ./ralph.sh plan 5               # Claude opus, plan mode, max 5 iterations
#   ./ralph.sh --model sonnet       # Claude sonnet, build mode, unlimited
#   ./ralph.sh --provider codex     # Codex, build mode, unlimited
#   ./ralph.sh --provider codex 10  # Codex, build mode, max 10 iterations
#
# Output:
#   - Terminal: Filtered readable output with colors
#   - output.log: Full JSON stream for debugging

set -euo pipefail

# =============================================================================
# ANSI Color Codes
# =============================================================================
BOLD='\033[1m'
DIM='\033[2m'
YELLOW='\033[33m'
GREEN='\033[32m'
RESET='\033[0m'

# =============================================================================
# Configuration
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="$SCRIPT_DIR/output.log"
PROJECT_PATH_PREFIX="/home/ubuntu/repos/robin-sidekick/"

# Temp file for subagent ID -> description mapping
SUBAGENT_MAP_FILE=$(mktemp)
# Temp file for rate limit detection
RATE_LIMIT_FILE=$(mktemp)
# Temp file for Codex last message
CODEX_LAST_MESSAGE_FILE=$(mktemp)
# Temp file for loop stats (context %, compaction count)
LOOP_STATS_FILE=$(mktemp)
trap "rm -f $SUBAGENT_MAP_FILE $RATE_LIMIT_FILE $CODEX_LAST_MESSAGE_FILE $LOOP_STATS_FILE" EXIT

# =============================================================================
# Argument Parsing
# =============================================================================
parse_arguments() {
    # Defaults
    PROVIDER="claude"
    MODEL="opus"

    # Parse flags
    while [[ "${1:-}" == --* ]]; do
        case "$1" in
            --provider)
                PROVIDER="${2:-claude}"
                shift 2 || { echo "Error: --provider requires a value (claude or codex)"; exit 1; }
                ;;
            --model)
                MODEL="${2:-opus}"
                shift 2 || { echo "Error: --model requires a value (opus, sonnet, or haiku)"; exit 1; }
                ;;
            *)
                echo "Error: Unknown flag '$1'"
                exit 1
                ;;
        esac
    done

    # Validate provider
    if [[ "$PROVIDER" != "claude" && "$PROVIDER" != "codex" ]]; then
        echo "Error: Invalid provider '$PROVIDER'. Use 'claude' or 'codex'."
        exit 1
    fi

    # Validate model
    if [[ "$MODEL" != "opus" && "$MODEL" != "sonnet" && "$MODEL" != "haiku" ]]; then
        echo "Error: Invalid model '$MODEL'. Use 'opus', 'sonnet', or 'haiku'."
        exit 1
    fi

    # Parse mode and iterations
    if [ "${1:-}" = "plan" ]; then
        MODE="plan"
        PROMPT_FILE="PROMPT_plan.md"
        MAX_ITERATIONS=${2:-0}
    elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
        MODE="build"
        PROMPT_FILE="PROMPT_build.md"
        MAX_ITERATIONS=$1
    else
        MODE="build"
        PROMPT_FILE="PROMPT_build.md"
        MAX_ITERATIONS=0
    fi
}

# =============================================================================
# Display Functions
# =============================================================================
print_header() {
    local branch
    local display_model
    local display_effort
    branch=$(git branch --show-current)
    if [[ "$PROVIDER" == "codex" ]]; then
        display_model=${CODEX_MODEL:-gpt-5.2-codex}
        display_effort=${CODEX_REASONING_EFFORT:-high}
    else
        display_model=$MODEL
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Provider: $PROVIDER"
    echo "Model:    $display_model"
    if [[ "$PROVIDER" == "codex" ]]; then
        echo "Effort:   $display_effort"
    fi
    echo "Mode:     $MODE"
    echo "Prompt:   $PROMPT_FILE"
    echo "Branch:   $branch"
    echo "Log:      $LOG_FILE"
    [ "$MAX_ITERATIONS" -gt 0 ] && echo "Max:      $MAX_ITERATIONS iterations"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

print_loop_separator() {
    local iteration=$1
    echo -e "\n\n======================== LOOP $iteration ========================\n"
}

print_loop_stats() {
    if [[ -f "$LOOP_STATS_FILE" ]]; then
        local ctx_pct compaction_count
        IFS='|' read -r ctx_pct compaction_count < "$LOOP_STATS_FILE"
        echo -e "${DIM}📈 Loop stats: context=${ctx_pct}% compactions=${compaction_count}${RESET}"
    fi
}

# =============================================================================
# JSON Processing (jq filter)
# =============================================================================
# This jq filter processes the Claude JSON stream and outputs formatted lines.
# Each output line is prefixed with a type marker for bash to apply colors:
#   BOLD:   - Bold white (session start/end)
#   YELLOW: - Yellow (spawn)
#   GREEN:  - Green (done)
#   DIM:    - Dim gray (subagent tools, compacting)
#   NORMAL: - Normal white (main agent)
#
# Context tracking: Main agent messages include context usage percentage.
#
JQ_FILTER='
# Helper: Extract short model name
def model_name:
    if . == null then "?"
    elif test("opus") then "opus"
    elif test("sonnet") then "sonnet"
    elif test("haiku") then "haiku"
    elif test("gpt-5-codex") then "gpt5-codex"
    elif test("gpt-5") then "gpt5"
    elif test("gpt-4") then "gpt4"
    elif test("o3") then "o3"
    elif test("o1") then "o1"
    else . end;

# Helper: Calculate context usage percentage (168K effective limit)
def context_pct:
    ((.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0)) as $total |
    (($total * 100 / 168000) | floor);

# Helper: Strip project path prefix and clean up value for display
def clean_path:
    gsub("/home/ubuntu/repos/robin-sidekick/"; "")
    | gsub("/Users/lei/repos/robin-sidekick/"; "");

# Helper: Extract the most useful value from tool input
def extract_tool_value:
    if .file_path then .file_path | clean_path
    elif .path and .pattern then "\(.pattern) in \(.path | clean_path)"
    elif .pattern then .pattern
    elif .command then .command | .[0:60] | gsub("\n"; " ")
    elif .query then .query | .[0:60]
    elif .content then "(content)"
    elif .todos then "(todos)"
    else tostring | .[0:60] | gsub("\n"; " ")
    end;

# Main processing logic
if .type == "system" and .subtype == "init" then
    "BOLD:\n🚀 SESSION START\n   Model: \(.model)\n   Tools: \(.tools | length) available"

elif .type == "system" and .subtype == "status" then
    "DIM:⏳ \(.status | ascii_upcase)..."

elif .type == "system" and .subtype == "compact_boundary" then
    "DIM:📦 Context compacted (was \(.compact_metadata.pre_tokens | . / 1000 | floor)k tokens)"

elif .type == "system" and .subtype == "task_notification" then
    "GREEN:✅ DONE: \(.summary)"

elif .type == "result" then
    # Helper to format numbers with commas
    def fmt: tostring | explode | reverse | . as $r | reduce range(0; length) as $i
        ([]; if ($i > 0 and $i % 3 == 0) then . + [44] else . end | . + [$r[$i]])
        | reverse | implode;

    # Calculate totals across all models
    (.modelUsage | to_entries | map(.value.inputTokens // 0) | add) as $total_in |
    (.modelUsage | to_entries | map(.value.outputTokens // 0) | add) as $total_out |
    (.modelUsage | to_entries | map(.value.cacheReadInputTokens // 0) | add) as $total_cache_read |
    (.modelUsage | to_entries | map(.value.cacheCreationInputTokens // 0) | add) as $total_cache_write |

    # Build per-model breakdown
    (.modelUsage | to_entries | map(
        "\(.key | split("-") | .[1]):" +
        " in=\(.value.inputTokens // 0 | fmt)" +
        " out=\(.value.outputTokens // 0 | fmt)" +
        " cache_read=\(.value.cacheReadInputTokens // 0 | fmt)" +
        " cache_write=\(.value.cacheCreationInputTokens // 0 | fmt)" +
        " $\(.value.costUSD // 0 | . * 100 | floor / 100)"
    ) | join("\n   ")) as $model_breakdown |

    # Build totals line
    "TOTAL: in=\($total_in | fmt) out=\($total_out | fmt) cache_read=\($total_cache_read | fmt) cache_write=\($total_cache_write | fmt)" as $totals |

    "BOLD:\n📊 SESSION END\n   Duration: \(.duration_ms / 1000 | floor)s\n   Cost: $\(.total_cost_usd | . * 100 | floor / 100)\n   Turns: \(.num_turns)\n   \($model_breakdown)\n   \($totals)"

elif .type == "assistant" then
    (.message.model | model_name) as $model |
    (.message.usage | context_pct) as $pct |
    (if .parent_tool_use_id == null then null else .parent_tool_use_id end) as $parent_id |

    .message.content[]? |

    if .name == "Task" then
        # Main agent spawning a subagent
        "YELLOW:\n🤖 [\($model)/main/\($pct)%] SPAWN: \(.input.description)\n   Agent: \(.input.subagent_type)"

    elif .name == "TaskOutput" then
        empty

    elif .type == "tool_use" then
        (.input | extract_tool_value) as $value |
        if $parent_id == null then
            # Main agent tool call
            "DIM:🔧 [\($model)/main/\($pct)%] \(.name): \($value)"
        else
            # Subagent tool call - output parent_id for later substitution
            "DIM:   [\($model)/\($parent_id)] \(.name): \($value)"
        end

    elif .type == "text" then
        if $parent_id == null then
            # Main agent text
            "NORMAL:💬 [\($model)/main/\($pct)%] \(.text)"
        else
            empty
        end

    else
        empty
    end

else
    empty
end
'

# Codex JSON processing (codex exec --json)
CODEX_JQ_FILTER='
def clean_cmd:
    gsub("^/bin/zsh -lc "; "")
    | gsub("^/bin/bash -lc "; "")
    | gsub("^'\''|\""; "")
    | gsub("'\''$|\"$"; "");

def clean_path:
    gsub("/home/ubuntu/repos/robin-sidekick/"; "")
    | gsub("/Users/lei/repos/robin-sidekick/"; "");

def short:
    .[0:80] | gsub("\n"; " ");

def prefix_lines($prefix; $text):
    ($text // "" | tostring | gsub("\r"; "")) as $t |
    if $t == "" then "" else ($t | split("\n") | map($prefix + .) | join("\n")) end;

def reasoning_header($text):
    ($text // "" | tostring | split("\n") | .[0] // "")
    | gsub("^\\*\\*"; "")
    | gsub("\\*\\*$"; "");

if .type == "item.completed" then
    if .item.type == "command_execution" then
        if (.item.exit_code // 0) == 0 then
            prefix_lines("DIM:🔧 [codex] "; (.item.command | clean_cmd | short))
        else
            prefix_lines("DIM:⚠️ [codex] "; ((.item.command | clean_cmd | short) + " (exit " + ((.item.exit_code // 0) | tostring) + ")")) +
            (if (.item.aggregated_output // "") != "" then
                "\n" + prefix_lines("DIM:↳ [codex] "; (.item.aggregated_output | short))
             else "" end)
        end
    elif .item.type == "file_change" then
        if (.item.changes | length) > 0 then
            (.item.changes
                | map("DIM:📝 [codex] " + (.kind // "update") + " " + (.path | clean_path))
                | join("\n"))
        else
            "DIM:📝 [codex] file_change"
        end
    elif .item.type == "reasoning" then
        prefix_lines("NORMAL:💭 [codex] "; reasoning_header(.item.text))
    elif .item.type == "agent_message" then
        prefix_lines("BOLD:💬 [codex] "; .item.text)
    else
        empty
    end

elif .type == "error" then
    prefix_lines("YELLOW:⚠️ [codex] "; (.message // .error // "error"))

else
    empty
end
'

# =============================================================================
# Stream Processing
# =============================================================================
format_number() {
    local num="${1:-0}"
    local out=""
    while [[ ${#num} -gt 3 ]]; do
        out=",${num: -3}${out}"
        num="${num:0:${#num}-3}"
    done
    echo "${num}${out}"
}

format_output() {
    local codex_in_total=0
    local codex_cached_total=0
    local codex_out_total=0
    local codex_has_usage=false
    local last_context_pct=0
    local compaction_count=0

    # Initialize loop stats file
    echo "0|0" > "$LOOP_STATS_FILE"

    while IFS= read -r line; do
        # Log everything to file
        echo "$line" >> "$LOG_FILE"

        # Skip non-JSON lines
        case "$line" in
            \{*) ;;
            "Reading prompt from stdin..."*) continue ;;
            *) echo "$line"; continue ;;
        esac

        # Detect rate limit messages (Claude)
        # Only match actual rate limit errors, not normal assistant messages mentioning "limit"
        local rate_limit_text
        rate_limit_text=$(echo "$line" | jq -r '
            def limit_text:
                (.content[]?.text // .message.content[]?.text // .result // empty);

            if .error == "rate_limit" then
                limit_text
            # Match result errors that look like rate limit messages (e.g., "You'\''ve hit your limit · resets 12am")
            elif .type == "result" and .is_error == true and (.result | tostring | test("hit your limit|rate.?limit"; "i")) then
                (.result | tostring)
            # Match assistant messages only if they contain the specific rate limit format with resets time
            elif .type == "assistant" and (limit_text | tostring | test("hit your limit.*resets"; "i")) then
                limit_text
            else empty end
        ' 2>/dev/null || true)

        if [[ -n "$rate_limit_text" ]]; then
            echo "$rate_limit_text" > "$RATE_LIMIT_FILE"
        fi

        # Track context usage and compactions for loop summary
        local loop_stats
        loop_stats=$(echo "$line" | jq -r '
            if .type == "assistant" and .parent_tool_use_id == null then
                # Main agent message - extract context percentage
                ((.message.usage.cache_creation_input_tokens // 0) + (.message.usage.cache_read_input_tokens // 0)) as $total |
                (($total * 100 / 168000) | floor) | "ctx:\(.)"
            elif .type == "system" and .subtype == "compact_boundary" then
                "compact"
            else empty end
        ' 2>/dev/null || true)

        if [[ "$loop_stats" == ctx:* ]]; then
            last_context_pct="${loop_stats#ctx:}"
        elif [[ "$loop_stats" == "compact" ]]; then
            compaction_count=$((compaction_count + 1))
        fi

        # Update stats file for retrieval after pipeline
        echo "${last_context_pct}|${compaction_count}" > "$LOOP_STATS_FILE"

        # Track Codex turn usage totals
        local codex_usage
        codex_usage=$(echo "$line" | jq -r '
            if .type == "turn.completed" then
                "\(.usage.input_tokens // 0)|\(.usage.cached_input_tokens // 0)|\(.usage.output_tokens // 0)"
            else empty end
        ' 2>/dev/null || true)

        if [[ -n "$codex_usage" ]]; then
            codex_has_usage=true
            local codex_in
            local codex_cached
            local codex_out
            IFS='|' read -r codex_in codex_cached codex_out <<< "$codex_usage"
            codex_in_total=$((codex_in_total + codex_in))
            codex_cached_total=$((codex_cached_total + codex_cached))
            codex_out_total=$((codex_out_total + codex_out))
        fi

        # Extract Task spawns for subagent ID mapping
        local task_info
        task_info=$(echo "$line" | jq -r '
            if .type == "assistant" and .parent_tool_use_id == null then
                .message.content[]? | select(.name == "Task") |
                "\(.id)|\(.input.description)"
            else empty end
        ' 2>/dev/null || true)

        if [[ -n "$task_info" ]]; then
            echo "$task_info" >> "$SUBAGENT_MAP_FILE"
        fi

        # Process JSON and get formatted output
        local output
        local is_codex
        is_codex=$(echo "$line" | jq -r '
            if (.type // "") | startswith("item.") then "yes"
            elif (.type // "") | startswith("turn.") then "yes"
            elif (.type // "") | startswith("thread.") then "yes"
            elif .type == "error" then "yes"
            else "no" end
        ' 2>/dev/null || true)

        if [[ "$is_codex" == "yes" ]]; then
            output=$(echo "$line" | jq -r "$CODEX_JQ_FILTER" 2>/dev/null || true)
        else
            output=$(echo "$line" | jq -r "$JQ_FILTER" 2>/dev/null || true)
        fi

        [[ -z "$output" ]] && continue

        # Replace subagent IDs with descriptions
        if [[ -f "$SUBAGENT_MAP_FILE" ]]; then
            while IFS='|' read -r id desc; do
                output="${output//$id/$desc}"
            done < "$SUBAGENT_MAP_FILE"
        fi

        # Apply colors based on prefix and print
        while IFS= read -r formatted_line; do
            case "$formatted_line" in
                BOLD:*)
                    echo -e "${BOLD}${formatted_line#BOLD:}${RESET}"
                    ;;
                YELLOW:*)
                    echo -e "${YELLOW}${formatted_line#YELLOW:}${RESET}"
                    ;;
                GREEN:*)
                    echo -e "${GREEN}${formatted_line#GREEN:}${RESET}"
                    ;;
                DIM:*)
                    echo -e "${DIM}${formatted_line#DIM:}${RESET}"
                    ;;
                NORMAL:*)
                    echo -e "${formatted_line#NORMAL:}"
                    ;;
                *)
                    echo -e "$formatted_line"
                    ;;
            esac
        done <<< "$output"
    done

    if [[ "$codex_has_usage" == "true" ]]; then
        local total_in_fmt
        local total_cached_fmt
        local total_out_fmt
        local total_fmt
        total_in_fmt=$(format_number "$codex_in_total")
        total_cached_fmt=$(format_number "$codex_cached_total")
        total_out_fmt=$(format_number "$codex_out_total")
        total_fmt=$(format_number $((codex_in_total + codex_cached_total + codex_out_total)))
        local summary
        summary=$(
            printf '%s\n%s' \
                "BOLD:📊 CODEX SESSION END" \
                "BOLD:   Tokens: in=${total_in_fmt} cached=${total_cached_fmt} out=${total_out_fmt} total=${total_fmt}"
        )
        while IFS= read -r formatted_line; do
            case "$formatted_line" in
                BOLD:*)
                    echo -e "${BOLD}${formatted_line#BOLD:}${RESET}"
                    ;;
                YELLOW:*)
                    echo -e "${YELLOW}${formatted_line#YELLOW:}${RESET}"
                    ;;
                GREEN:*)
                    echo -e "${GREEN}${formatted_line#GREEN:}${RESET}"
                    ;;
                DIM:*)
                    echo -e "${DIM}${formatted_line#DIM:}${RESET}"
                    ;;
                NORMAL:*)
                    echo -e "${formatted_line#NORMAL:}"
                    ;;
                *)
                    echo -e "$formatted_line"
                    ;;
            esac
        done <<< "$summary"
    fi
}

# =============================================================================
# Provider Commands
# =============================================================================
run_claude() {
    cat "$PROMPT_FILE" | claude -p \
        --dangerously-skip-permissions \
        --output-format=stream-json \
        --model "$MODEL" \
        --verbose
}

run_codex() {
    local reasoning_effort=${CODEX_REASONING_EFFORT:-high}
    local codex_model=${CODEX_MODEL:-gpt-5.2-codex}
    cat "$PROMPT_FILE" | codex exec \
        --dangerously-bypass-approvals-and-sandbox \
        --json \
        --model "$codex_model" \
        --output-last-message "$CODEX_LAST_MESSAGE_FILE" \
        -c "model_reasoning_effort=\"${reasoning_effort}\"" \
        2>&1
}

run_provider() {
    case "$PROVIDER" in
        claude)
            run_claude
            ;;
        codex)
            run_codex
            ;;
    esac
}

# =============================================================================
# Rate Limit Handling
# =============================================================================
wait_for_rate_limit_reset() {
    local message
    message=$(cat "$RATE_LIMIT_FILE")

    echo "Rate limit hit: $message"

    local wait_info=""
    local date_is_bsd=false
    if date -j -f "%Y-%m-%d %H:%M:%S" "2000-01-01 00:00:00" +%s >/dev/null 2>&1; then
        date_is_bsd=true
    fi
    local time_str=""
    local tz=""
    time_str=$(printf '%s' "$message" | sed -nE 's/.*resets[^0-9]*([0-9:apmAPM]+).*/\1/p')
    tz=$(printf '%s' "$message" | sed -nE 's/.*\(([^)]+)\).*/\1/p')
    if [[ -n "$time_str" && -n "$tz" ]]; then
        local t
        t=$(printf '%s' "$time_str" | tr '[:upper:]' '[:lower:]')
        local ampm=""
        if [[ "$t" =~ (am|pm)$ ]]; then
            ampm="${BASH_REMATCH[1]}"
            t="${t%$ampm}"
        fi

        local hour=0
        local minute=0
        if [[ "$t" == *:* ]]; then
            hour="${t%%:*}"
            minute="${t##*:}"
        else
            hour="$t"
        fi

        hour=${hour:-0}
        minute=${minute:-0}

        if [[ "$ampm" == "am" && "$hour" -eq 12 ]]; then
            hour=0
        elif [[ "$ampm" == "pm" && "$hour" -ne 12 ]]; then
            hour=$((hour + 12))
        fi

        local now_epoch
        now_epoch=$(TZ="$tz" date +%s 2>/dev/null || true)
        if [[ -n "$now_epoch" ]]; then
            local today
            today=$(TZ="$tz" date +%Y-%m-%d 2>/dev/null || true)

            local reset_epoch=""
            if $date_is_bsd; then
                reset_epoch=$(TZ="$tz" date -j -f "%Y-%m-%d %H:%M:%S" \
                    "$today $(printf "%02d:%02d:00" "$hour" "$minute")" +%s 2>/dev/null || true)
            else
                reset_epoch=$(TZ="$tz" date -d "$today $(printf "%02d:%02d:00" "$hour" "$minute")" +%s 2>/dev/null || true)
            fi
            if [[ -n "$reset_epoch" && "$reset_epoch" -le "$now_epoch" ]]; then
                if $date_is_bsd; then
                    reset_epoch=$(TZ="$tz" date -j -v+1d -f "%Y-%m-%d %H:%M:%S" \
                        "$today $(printf "%02d:%02d:00" "$hour" "$minute")" +%s 2>/dev/null || true)
                else
                    reset_epoch=$(TZ="$tz" date -d "tomorrow $(printf "%02d:%02d:00" "$hour" "$minute")" +%s 2>/dev/null || true)
                fi
            fi

            if [[ -n "$reset_epoch" ]]; then
                local retry_epoch=$((reset_epoch + 60))
                local wait_seconds_fallback=$((retry_epoch - now_epoch))
                local now_str
                local reset_str
                local retry_str
                now_str=$(TZ="$tz" date "+%Y-%m-%d %H:%M:%S %Z")
                # Use BSD or GNU date syntax for formatting epoch timestamps
                if $date_is_bsd; then
                    reset_str=$(TZ="$tz" date -r "$reset_epoch" "+%Y-%m-%d %H:%M:%S %Z")
                    retry_str=$(TZ="$tz" date -r "$retry_epoch" "+%Y-%m-%d %H:%M:%S %Z")
                else
                    reset_str=$(TZ="$tz" date -d "@$reset_epoch" "+%Y-%m-%d %H:%M:%S %Z")
                    retry_str=$(TZ="$tz" date -d "@$retry_epoch" "+%Y-%m-%d %H:%M:%S %Z")
                fi

                wait_info="${wait_seconds_fallback}|${now_str}|${reset_str}|${retry_str}"
            fi
        fi
    fi

    local wait_seconds
    local now_str
    local reset_str
    local retry_str
    IFS='|' read -r wait_seconds now_str reset_str retry_str <<< "$wait_info"

    if [[ -n "$wait_seconds" && "$wait_seconds" -gt 0 ]]; then
        echo "Current time: $now_str"
        echo "Reset time:   $reset_str"
        echo "Retry time:   $retry_str (reset + 1 min)"
        echo "Pausing for ${wait_seconds}s..."
        sleep "$wait_seconds"
        return 0
    fi

    echo "Could not parse reset time. Exiting to avoid retrying."
    exit 1
}

# =============================================================================
# Main Loop
# =============================================================================
main() {
    parse_arguments "$@"

    # Verify prompt file exists
    if [ ! -f "$PROMPT_FILE" ]; then
        echo "Error: $PROMPT_FILE not found"
        exit 1
    fi

    print_header

    local iteration=0
    local current_branch
    current_branch=$(git branch --show-current)

    while true; do
        if [ "$MAX_ITERATIONS" -gt 0 ] && [ "$iteration" -ge "$MAX_ITERATIONS" ]; then
            echo "Reached max iterations: $MAX_ITERATIONS"
            break
        fi

        # Run the selected provider
        : > "$RATE_LIMIT_FILE"
        if [[ "$PROVIDER" == "codex" ]]; then
            : > "$CODEX_LAST_MESSAGE_FILE"
        fi
        local provider_status=0
        set +e
        run_provider | format_output
        provider_status=$?
        set -e

        # Print loop stats after provider completes
        print_loop_stats

        if [[ -s "$RATE_LIMIT_FILE" ]]; then
            wait_for_rate_limit_reset
            : > "$RATE_LIMIT_FILE"
            print_loop_separator "$iteration"
            continue
        fi

        if [[ "$provider_status" -ne 0 ]]; then
            echo "Provider exited with status $provider_status"
            exit "$provider_status"
        fi

        # Push changes after each iteration
        git push origin "$current_branch" 2>/dev/null || {
            echo "Failed to push. Creating remote branch..."
            git push -u origin "$current_branch"
        }

        iteration=$((iteration + 1))
        print_loop_separator "$iteration"
    done
}

main "$@"
