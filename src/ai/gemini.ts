import * as vscode from 'vscode';
import { GitContext, getGitAPI } from '../git';

/**
 * Generates a branch name using native Antigravity Gemini integration.
 * Uses Antigravity's built-in Language Server and Gemini model (no external API, no API keys).
 */
export async function generateWithNativeAntigravity(
  context: GitContext,
  _cancellationToken?: vscode.CancellationToken
): Promise<string> {
  let summary = context.commitMessage?.trim();

  const config = vscode.workspace.getConfiguration('branchAssistant');
  const keepCommitMessage = config.get<boolean>('populateCommitMessage', true);

  // 1. If SCM input box already has a commit message or summary, convert it directly
  if (summary) {
    return convertSummaryToBranchName(summary, context.branchPrefix);
  }

  const gitAPI = await getGitAPI();
  const repo = gitAPI?.getRepository(vscode.Uri.file(context.repoRoot));
  const originalCommitMessage = repo?.inputBox?.value ?? '';

  // 2. Invoke Antigravity's native Gemini commit message generator
  try {
    const res = await vscode.commands.executeCommand<any>(
      'antigravity.generateCommitMessage',
      context.repoRoot
    );

    if (typeof res === 'string' && res.trim()) {
      summary = res.trim();
    }
  } catch (err) {
    console.warn('[Branch Assistant] antigravity.generateCommitMessage failed:', err);
  }

  // 3. Check if Antigravity's command populated the SCM input box
  if (!summary && repo?.inputBox?.value?.trim()) {
    summary = repo.inputBox.value.trim();
  }

  // If user disabled keeping the commit message in the SCM input box, restore original value
  if (!keepCommitMessage && repo && repo.inputBox) {
    repo.inputBox.value = originalCommitMessage;
  }

  // 4. If we got a Gemini-generated summary from Antigravity, convert it
  if (summary) {
    return convertSummaryToBranchName(summary, context.branchPrefix);
  }

  // 5. Fallback: Parse the local git diff to derive a clean branch name
  return deriveBranchNameFromDiff(context);
}

/**
 * Converts a Gemini-generated commit message into a clean Git branch name.
 */
export function convertSummaryToBranchName(summary: string, branchPrefix: string = ''): string {
  // Take the first line of the summary
  const firstLine = summary.split('\n')[0].trim();

  // Detect conventional commit prefix: feat, fix, chore, refactor, docs, test, perf, ci, etc.
  const match = firstLine.match(/^([a-zA-Z]+)(?:\([^)]+\))?!?:?\s*(.*)$/);
  let type = 'feat';
  let desc = firstLine;

  if (match) {
    const rawType = match[1].toLowerCase();
    const knownTypes = ['feat', 'fix', 'chore', 'refactor', 'docs', 'style', 'test', 'perf', 'ci', 'build'];
    if (knownTypes.includes(rawType)) {
      type = rawType;
      desc = match[2];
    } else if (['add', 'create', 'implement', 'support', 'enable'].includes(rawType)) {
      type = 'feat';
      desc = match[1] + ' ' + match[2];
    } else if (['fix', 'resolve', 'prevent', 'patch', 'repair'].includes(rawType)) {
      type = 'fix';
      desc = match[1] + ' ' + match[2];
    }
  }

  // Clean description into a kebab-case slug
  let slug = desc
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  // Limit slug to ~35 characters without cutting off in middle of a word if possible
  if (slug.length > 35) {
    const trimmed = slug.substring(0, 35);
    const lastHyphen = trimmed.lastIndexOf('-');
    slug = lastHyphen > 15 ? trimmed.substring(0, lastHyphen) : trimmed;
  }

  // Clean up any trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');
  if (!slug) {
    slug = 'changes';
  }

  let finalBranch = `${type}/${slug}`;

  // Handle configured prefix
  if (branchPrefix) {
    const normPrefix = branchPrefix.endsWith('/') ? branchPrefix : `${branchPrefix}/`;
    if (normPrefix === 'feature/' && finalBranch.startsWith('feat/')) {
      finalBranch = finalBranch.replace(/^feat\//, 'feature/');
    } else if (!finalBranch.startsWith(normPrefix)) {
      finalBranch = `${normPrefix}${finalBranch}`;
    }
  }

  return finalBranch;
}

/**
 * Derives a branch name from changed file paths in the local diff if Gemini is unavailable.
 */
function deriveBranchNameFromDiff(context: GitContext): string {
  const diff = context.stagedDiff || context.workingDiff;
  if (!diff) {
    const fallback = `${context.branchPrefix || 'feature/'}update-${Date.now().toString().slice(-4)}`;
    return fallback;
  }

  // Extract changed file names from diff
  const fileMatches = diff.match(/---\s+a\/(.*)/g) || [];
  const files = fileMatches.map((m) => m.replace(/---\s+a\//, '').trim()).filter(Boolean);

  if (files.length > 0) {
    const firstFile = files[0];
    const baseName = firstFile.split('/').pop()?.split('.')[0] || 'changes';
    const cleanBase = baseName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    return `${context.branchPrefix || 'feat/'}update-${cleanBase}`;
  }

  return `${context.branchPrefix || 'feat/'}work-in-progress`;
}
