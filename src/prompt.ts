import { GitContext } from './git';

/**
 * Builds a prompt for the AI model to generate an optimal git branch name.
 */
export function buildBranchPrompt(context: GitContext, convention: string = 'conventional'): string {
  // Truncate diff to avoid exceeding token limits while keeping essential structural changes
  const rawDiff = context.stagedDiff || context.workingDiff;
  const truncatedDiff = rawDiff.length > 8000 ? rawDiff.substring(0, 8000) + '\n... [diff truncated]' : rawDiff;

  const existingSample = context.existingBranches.slice(0, 10).join(', ');

  return `You are an expert Git assistant. Generate a single, concise, valid Git branch name for the provided code changes.

CONSTRAINTS:
1. Output ONLY the branch name string (no quotes, no markdown, no explanation, no backticks, no trailing punctuation).
2. Must follow Git branch naming rules: all lowercase, alphanumeric and hyphens only, no spaces, no special characters like [~^:?*\\].
3. Format:
   ${
     convention === 'conventional'
       ? '- Use standard conventional prefix followed by kebab-case description: "feat/...", "fix/...", "refactor/...", "chore/...", "docs/...", "test/..."'
       : '- Use short kebab-case description without prefix (e.g. "auth-token-refresh")'
   }
4. Length: Keep it concise, between 15 and 45 characters.
5. If a prefix is specified below, the generated name MUST start with that exact prefix.
${context.branchPrefix ? `REQUIRED PREFIX: "${context.branchPrefix}"` : ''}
${context.commitMessage ? `USER COMMIT MESSAGE INTENT: "${context.commitMessage}"` : ''}
${existingSample ? `EXISTING BRANCHES (DO NOT DUPLICATE): ${existingSample}` : ''}
BASE BRANCH: "${context.currentBranch}"

GIT DIFF:
\`\`\`diff
${truncatedDiff || '(No file changes detected; use base branch or commit message context)'}
\`\`\`

Generate the branch name now:`;
}

/**
 * Normalizes and sanitizes the branch name returned by an AI model.
 */
export function sanitizeBranchName(rawName: string, prefix: string = ''): string {
  let cleaned = rawName
    .replace(/[`"'\r\n]/g, '') // Remove backticks, quotes, newlines
    .trim()
    .replace(/^branch:\s*/i, '') // Remove common AI conversational prefixes
    .replace(/^[#>-]\s*/, '')
    .toLowerCase();

  // If AI gave multiple lines or explanation, take only the first token
  cleaned = cleaned.split(/[\s\n]/)[0] || '';

  // Replace invalid Git ref characters with hyphens
  cleaned = cleaned.replace(/[^a-z0-9/_-]/g, '-');
  cleaned = cleaned.replace(/\/+/g, '/'); // collapse double slashes
  cleaned = cleaned.replace(/-+/g, '-'); // collapse double hyphens
  cleaned = cleaned.replace(/^[-/]+/, ''); // remove leading slash or hyphen
  cleaned = cleaned.replace(/[-/]+$/, ''); // remove trailing slash or hyphen

  // If a prefix is required and not yet present, prepend it
  if (prefix) {
    const normalizedPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`;
    if (!cleaned.startsWith(normalizedPrefix) && !cleaned.startsWith(prefix)) {
      cleaned = `${normalizedPrefix}${cleaned}`;
    }
  }

  return cleaned;
}
