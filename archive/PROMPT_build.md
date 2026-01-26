# 1: Understand the project context first
1-0. Run bash command to get current datetime. Say a pun-ny greeting to the user with the current datetime. 
1-1. Spawn a subagent using Opus model to read every file in `specs/*` and @IMPLEMENTATION_PLAN.md. Have the subagent choose the most important item to address next, and that will be your main task this session. 
1-2. For reference, the application source code is in `src/*`.



# 2: Understand the context around the task
2-1. Read the spec related to the selected item into your context window directly. 
2-2. The item you select should be small enough that it can be completed by one really good full stack engineer in one day. If it's too big, consider selecting one or more sub-tasks from the item instead. Update @IMPLEMENTATION_PLAN.md if you break the item down into sub-tasks.
2-3. Before making changes, use parallel subagents to understand the current codebase implementation. Don't make assumptions about what has or has not been written. 
- **codebase-locator**: Find WHERE files and components live 
- **codebase-analyzer**: Understand HOW specific code works (without critiquing) 
- **codebase-pattern-finder**: Find examples of existing patterns (without evaluating)
2-4. The key is to use these agents intelligently:
- Start with locator agents to find what exists
- Then use analyzer agents on the most promising findings
- Run multiple agents in parallel when searching for different things
- Each agent knows its job - just tell it what you're looking for
- Remind agents they are documenting, not evaluating
2-5. IMPORTANT: Wait for ALL sub-agent tasks to complete before proceeding. Compile all sub-agent results and connect findings across different components. 



# 3: How to work
3-1. You may only use 1 subagent for build/tests. DO NOT run builds/tests in parallel. You may use parallel subagents to implement. 
3-2. After implementing functionality or resolving problems, run the tests for that unit of code that was improved. If functionality is missing then it's your job to add it as per the application specifications. Ultrathink.
3-3. When you discover issues, immediately update @IMPLEMENTATION_PLAN.md with your findings using a subagent. When resolved, update and remove the item.
3-4. When the tests pass, update @IMPLEMENTATION_PLAN.md, then `git add -A` then `git commit` with a message describing the changes. After the commit, `git push`.
3-5. Spawn parallel sub-agent tasks for searches / reads. Use Sonnet for simple searches. Use Opus subagents when complex reasoning is needed (debugging, architectural decisions).
3-6. You should aim for clarity and easy-to-read code. Code quality matters.
3-7. You should be concise where possible. 



# 9: IMPORTANT CAVEATS
9-1. Important: When authoring documentation, capture the why — tests and implementation importance.
9-2. Important: Single sources of truth, no migrations/adapters. If tests unrelated to your work fail, resolve them as part of the increment.
9-3. As soon as there are no build or test errors create a git tag. If there are no git tags start at 0.0.0 and increment patch by 1 for example 0.0.1  if 0.0.0 does not exist.
9-4. You may add extra logging if required to debug issues.
9-5. Keep @IMPLEMENTATION_PLAN.md current with learnings using a subagent — future work depends on this to avoid duplicating efforts. Update especially after finishing your turn.
9-6. When you learn something new about how to run the application, update @AGENTS.md using a subagent but keep it brief. For example if you run commands multiple times before learning the correct command then that file should be updated.
9-7. IMPORTANT: Keep @AGENTS.md operational only — status updates and progress notes belong in `IMPLEMENTATION_PLAN.md`. A bloated AGENTS.md pollutes every future loop's context.
9-8. For any bugs you notice, resolve them or document them in @IMPLEMENTATION_PLAN.md using a subagent even if it is unrelated to the current piece of work.
9-9. Implement functionality completely. Placeholders and stubs waste efforts and time redoing the same work.
9-10. When @IMPLEMENTATION_PLAN.md becomes large periodically clean out the items that are completed from the file using a subagent.
9-11. If you find inconsistencies in the specs/* then use an Opus 4.5 subagent with 'ultrathink' requested to update the specs.
