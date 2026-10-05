import * as vscode from 'vscode';
import { GitContext } from '../git';
import { buildBranchPrompt, sanitizeBranchName } from '../prompt';
import { resolveProviderInfo } from '../detector';
import { generateWithCopilot } from './copilot';
import { generateWithNativeAntigravity } from './gemini';

/**
 * Unified entry point to generate a branch name based on the Git context.
 */
export async function generateBranchName(
  context: GitContext,
  cancellationToken?: vscode.CancellationToken
): Promise<string> {
  const providerInfo = resolveProviderInfo();
  const config = vscode.workspace.getConfiguration('branchAssistant');
  const convention = config.get<string>('convention', 'conventional');

  let rawBranchName = '';

  if (providerInfo.provider === 'gemini' || providerInfo.isAntigravity) {
    // In Antigravity: ALWAYS use native Antigravity Gemini integration (no external API keys)
    rawBranchName = await generateWithNativeAntigravity(context, cancellationToken);
  } else {
    // In VS Code: Use official GitHub Copilot Git pipeline
    const prompt = buildBranchPrompt(context, convention);
    rawBranchName = await generateWithCopilot(context, prompt, cancellationToken);
  }

  const sanitized = sanitizeBranchName(rawBranchName, context.branchPrefix);

  if (!sanitized) {
    throw new Error('Could not generate a valid branch name from the provided changes.');
  }

  return sanitized;
}
