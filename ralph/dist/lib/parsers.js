// Parse DISPATCH_RESULT YAML block from Agent 1 output
export function parseDispatchResult(output) {
    // Find the DISPATCH_RESULT block - handle both with and without code block wrapper
    const match = output.match(/DISPATCH_RESULT:\s*\n([\s\S]*?)(?:\n```|$)/) ||
        output.match(/```\s*\n?DISPATCH_RESULT:\s*\n([\s\S]*?)```/);
    if (!match) {
        console.error('Could not find DISPATCH_RESULT block in output');
        return null;
    }
    const yamlContent = match[1];
    // Check for no_work case
    if (yamlContent.includes('no_work: true')) {
        const reasonMatch = yamlContent.match(/reason:\s*(.+)/);
        return {
            noWork: true,
            reason: reasonMatch?.[1]?.trim() || 'No work available',
            issueId: '',
            issueIdentifier: '',
            issueTitle: '',
            issueDescription: '',
            stage: 'research',
            projectName: '',
            claimTimestamp: '',
            labels: [],
            priority: 'none',
            existingArtifacts: {},
            parentIssue: '',
            subIssues: '',
            blockingIssues: '',
            blockedByIssues: '',
            relatedContext: '',
            commentsSummary: '',
        };
    }
    // Parse YAML-like content (simple parser, not full YAML)
    const result = {
        existingArtifacts: {},
        labels: [],
    };
    // Parse simple key-value pairs
    const issueIdMatch = yamlContent.match(/issue_id:\s*(.+)/);
    if (issueIdMatch)
        result.issueId = issueIdMatch[1].trim();
    const identifierMatch = yamlContent.match(/issue_identifier:\s*(.+)/);
    if (identifierMatch)
        result.issueIdentifier = identifierMatch[1].trim();
    const titleMatch = yamlContent.match(/issue_title:\s*(.+)/);
    if (titleMatch)
        result.issueTitle = titleMatch[1].trim();
    const stageMatch = yamlContent.match(/stage:\s*(.+)/);
    if (stageMatch) {
        const stage = stageMatch[1].trim().toLowerCase();
        if (['research', 'specification', 'plan', 'implement', 'validate', 'oneshot'].includes(stage)) {
            result.stage = stage;
        }
    }
    const projectMatch = yamlContent.match(/project_name:\s*(.+)/);
    if (projectMatch)
        result.projectName = projectMatch[1].trim();
    const timestampMatch = yamlContent.match(/claim_timestamp:\s*(.+)/);
    if (timestampMatch)
        result.claimTimestamp = timestampMatch[1].trim();
    const priorityMatch = yamlContent.match(/priority:\s*(.+)/);
    if (priorityMatch) {
        const priority = priorityMatch[1].trim().toLowerCase();
        if (['urgent', 'high', 'medium', 'low', 'none'].includes(priority)) {
            result.priority = priority;
        }
    }
    // Parse labels array
    const labelsMatch = yamlContent.match(/labels:\s*\[([^\]]*)\]/);
    if (labelsMatch) {
        result.labels = labelsMatch[1]
            .split(',')
            .map(l => l.trim().replace(/['"]/g, ''))
            .filter(l => l.length > 0);
    }
    // Parse multiline description
    const descMatch = yamlContent.match(/issue_description:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (descMatch) {
        result.issueDescription = descMatch[1].trim();
    }
    else {
        const singleLineDesc = yamlContent.match(/issue_description:\s*(.+)/);
        if (singleLineDesc)
            result.issueDescription = singleLineDesc[1].trim();
    }
    // Parse existing artifacts
    const researchMatch = yamlContent.match(/research:\s*(.+)/);
    if (researchMatch && researchMatch[1].trim()) {
        result.existingArtifacts.research = researchMatch[1].trim();
    }
    const specificationMatch = yamlContent.match(/specification:\s*(.+)/);
    if (specificationMatch && specificationMatch[1].trim()) {
        result.existingArtifacts.specification = specificationMatch[1].trim();
    }
    const planMatch = yamlContent.match(/plan:\s*(.+)/);
    if (planMatch && planMatch[1].trim()) {
        result.existingArtifacts.plan = planMatch[1].trim();
    }
    // Parse comments summary
    const commentMatch = yamlContent.match(/comments_summary:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (commentMatch) {
        result.commentsSummary = commentMatch[1].trim();
    }
    else {
        const singleLineComment = yamlContent.match(/comments_summary:\s*(.+)/);
        if (singleLineComment)
            result.commentsSummary = singleLineComment[1].trim();
    }
    // Parse parent_issue
    const parentMatch = yamlContent.match(/parent_issue:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (parentMatch) {
        result.parentIssue = parentMatch[1].trim();
    }
    else {
        const singleLineParent = yamlContent.match(/parent_issue:\s*(.+)/);
        if (singleLineParent)
            result.parentIssue = singleLineParent[1].trim();
    }
    // Parse sub_issues
    const subMatch = yamlContent.match(/sub_issues:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (subMatch) {
        result.subIssues = subMatch[1].trim();
    }
    else {
        const singleLineSub = yamlContent.match(/sub_issues:\s*(.+)/);
        if (singleLineSub)
            result.subIssues = singleLineSub[1].trim();
    }
    // Parse blocking_issues
    const blockingMatch = yamlContent.match(/blocking_issues:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (blockingMatch) {
        result.blockingIssues = blockingMatch[1].trim();
    }
    else {
        const singleLineBlocking = yamlContent.match(/blocking_issues:\s*(.+)/);
        if (singleLineBlocking)
            result.blockingIssues = singleLineBlocking[1].trim();
    }
    // Parse blocked_by_issues
    const blockedByMatch = yamlContent.match(/blocked_by_issues:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (blockedByMatch) {
        result.blockedByIssues = blockedByMatch[1].trim();
    }
    else {
        const singleLineBlockedBy = yamlContent.match(/blocked_by_issues:\s*(.+)/);
        if (singleLineBlockedBy)
            result.blockedByIssues = singleLineBlockedBy[1].trim();
    }
    // Parse related_context
    const relatedMatch = yamlContent.match(/related_context:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (relatedMatch) {
        result.relatedContext = relatedMatch[1].trim();
    }
    else {
        const singleLineRelated = yamlContent.match(/related_context:\s*(.+)/);
        if (singleLineRelated)
            result.relatedContext = singleLineRelated[1].trim();
    }
    // Validate required fields
    if (!result.issueId || !result.issueIdentifier || !result.stage) {
        console.error('Missing required fields in DISPATCH_RESULT');
        return null;
    }
    return result;
}
// Parse WORK_RESULT YAML block from Agent 2 output
export function parseWorkResult(output) {
    const match = output.match(/WORK_RESULT:\s*\n([\s\S]*?)(?:\n```|$)/);
    if (!match) {
        console.error('Could not find WORK_RESULT block in output');
        return null;
    }
    const yamlContent = match[1];
    const result = {};
    // Parse success
    const successMatch = yamlContent.match(/success:\s*(true|false)/i);
    if (successMatch) {
        result.success = successMatch[1].toLowerCase() === 'true';
    }
    else {
        result.success = false;
    }
    // Parse stage_completed
    const stageMatch = yamlContent.match(/stage_completed:\s*(.+)/);
    if (stageMatch) {
        const stage = stageMatch[1].trim().toLowerCase();
        if (['research', 'specification', 'plan', 'implement', 'validate', 'oneshot'].includes(stage)) {
            result.stageCompleted = stage;
        }
    }
    // Parse artifact_path
    const artifactMatch = yamlContent.match(/artifact_path:\s*(.+)/);
    if (artifactMatch && artifactMatch[1].trim()) {
        result.artifactPath = artifactMatch[1].trim();
    }
    // Parse commit_hash
    const commitMatch = yamlContent.match(/commit_hash:\s*(.+)/);
    if (commitMatch && commitMatch[1].trim()) {
        result.commitHash = commitMatch[1].trim();
    }
    // Parse next_status
    const statusMatch = yamlContent.match(/next_status:\s*["']?([^"'\n]+)["']?/);
    if (statusMatch && statusMatch[1].trim()) {
        result.nextStatus = statusMatch[1].trim();
    }
    // Parse multiline summary
    const summaryMatch = yamlContent.match(/summary:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (summaryMatch) {
        result.summary = summaryMatch[1].trim();
    }
    else {
        const singleLineSummary = yamlContent.match(/summary:\s*(.+)/);
        if (singleLineSummary)
            result.summary = singleLineSummary[1].trim();
    }
    // Parse multiline error
    const errorMatch = yamlContent.match(/error:\s*\|\s*\n([\s\S]*?)(?=\n\s*\w+:|$)/);
    if (errorMatch) {
        result.error = errorMatch[1].trim();
    }
    else {
        const singleLineError = yamlContent.match(/error:\s*(.+)/);
        if (singleLineError)
            result.error = singleLineError[1].trim();
    }
    // Parse sub_issues array (optional, for large issues that should be broken down)
    try {
        // Match sub_issues: followed by all indented content (lines starting with spaces)
        const subIssuesMatch = yamlContent.match(/sub_issues:\s*\n((?:[ ]+.+\n?)*)/);
        if (subIssuesMatch) {
            const subIssuesContent = subIssuesMatch[1];
            const subIssues = [];
            // Match each sub-issue block (starts with "- title:")
            // Use multiline mode to match at start of line or after newline
            const issueBlocks = subIssuesContent.split(/^\s*-\s+title:/m).slice(1);
            for (const block of issueBlocks) {
                const titleMatch = block.match(/^(.+)/);
                const descMatch = block.match(/description:\s*\|\s*\n([\s\S]*?)(?=\n\s{6}\w+:|$)/);
                const planMatch = block.match(/plan_section:\s*["']?([^"'\n]+)["']?/);
                const scopeMatch = block.match(/estimated_scope:\s*["']?([^"'\n]+)["']?/);
                if (titleMatch) {
                    subIssues.push({
                        title: titleMatch[1].trim().replace(/^["']|["']$/g, ''),
                        description: descMatch?.[1]?.trim() || '',
                        planSection: planMatch?.[1]?.trim() || '',
                        estimatedScope: scopeMatch?.[1]?.trim() || '',
                    });
                }
            }
            if (subIssues.length > 0) {
                result.subIssues = subIssues;
            }
        }
    }
    catch {
        // Gracefully ignore sub_issues parsing errors - this is an optional field
        console.warn('Failed to parse sub_issues from WORK_RESULT, continuing without them');
    }
    return result;
}
// Parse LINEAR_UPDATE YAML block from Agent 3 output
export function parseLinearUpdate(output) {
    const match = output.match(/LINEAR_UPDATE:\s*\n([\s\S]*?)(?:\n```|$)/);
    if (!match) {
        console.error('Could not find LINEAR_UPDATE block in output');
        return null;
    }
    const yamlContent = match[1];
    const result = {};
    // Parse comment_posted
    const commentMatch = yamlContent.match(/comment_posted:\s*(true|false)/i);
    result.commentPosted = commentMatch?.[1]?.toLowerCase() === 'true';
    // Parse status_updated
    const statusMatch = yamlContent.match(/status_updated:\s*(true|false)/i);
    result.statusUpdated = statusMatch?.[1]?.toLowerCase() === 'true';
    // Parse new_status
    const newStatusMatch = yamlContent.match(/new_status:\s*["']?([^"'\n]+)["']?/);
    if (newStatusMatch && newStatusMatch[1].trim()) {
        result.newStatus = newStatusMatch[1].trim();
    }
    // Parse error
    const errorMatch = yamlContent.match(/error:\s*(.+)/);
    if (errorMatch) {
        result.error = errorMatch[1].trim();
    }
    return result;
}
//# sourceMappingURL=parsers.js.map