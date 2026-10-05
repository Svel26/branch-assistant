import * as vscode from 'vscode';
import { GitContext, getGitAPI } from '../git';
import { convertSummaryToBranchName } from './gemini';

/**
 * Generates a branch name using GitHub Copilot.
 *
 * Prioritizes the official Copilot Git commit generation command
 * (`github.copilot.git.generateCommitMessage`), and falls back to
 * the Copilot Chat Language Model API (`vscode.lm`) if needed.
 */
export async function generateWithCopilot(
  context: GitContext,
  prompt: string,
  cancellationToken?: vscode.CancellationToken
): Promise<string> {
  // 1. Check if SCM input box already has a commit message from user or Copilot
  let summary = context.commitMessage?.trim();
  if (summary) {
    return convertSummaryToBranchName(summary, context.branchPrefix);
  }

  const config = vscode.workspace.getConfiguration('branchAssistant');
  const keepCommitMessage = config.get<boolean>('populateCommitMessage', true);

  const gitAPI = await getGitAPI();
  const repo = gitAPI?.getRepository(vscode.Uri.file(context.repoRoot));
  const originalCommitMessage = repo?.inputBox?.value ?? '';

  // 2. Try the official GitHub Copilot Git command: github.copilot.git.generateCommitMessage
  try {
    const commands = await vscode.commands.getCommands();
    const copilotGitCommand = commands.find(
      (cmd) =>
        cmd === 'github.copilot.git.generateCommitMessage' ||
        cmd === 'workbench.action.chat.generateCommitMessage'
    );

    if (copilotGitCommand) {
      await vscode.commands.executeCommand(copilotGitCommand);

      // Read back the commit message populated into the SCM input box by Copilot
      if (repo?.inputBox?.value?.trim()) {
        summary = repo.inputBox.value.trim();

        // If user disabled keeping the commit message in the SCM input box, restore original value
        if (!keepCommitMessage && repo && repo.inputBox) {
          repo.inputBox.value = originalCommitMessage;
        }

        return convertSummaryToBranchName(summary, context.branchPrefix);
      }
    }
  } catch (err) {
    console.warn('[Branch Assistant] Official Copilot git command attempt:', err);
  }

  // 3. Fallback: Query the Copilot Language Model directly via vscode.lm
  return generateWithCopilotLM(prompt, cancellationToken);
}

/**
 * Direct call to GitHub Copilot's language model via vscode.lm.
 */
async function generateWithCopilotLM(
  prompt: string,
  cancellationToken?: vscode.CancellationToken
): Promise<string> {
  const config = vscode.workspace.getConfiguration('branchAssistant');
  const preferredFamily = config.get<string>('copilotModelFamily', 'gpt-4o');

  if (typeof vscode.lm?.selectChatModels !== 'function') {
    throw new Error(
      'VS Code Language Model API is not available. Please ensure GitHub Copilot is installed and active.'
    );
  }

  // Look for Copilot models
  let models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
  if (!models || models.length === 0) {
    models = await vscode.lm.selectChatModels();
  }

  if (!models || models.length === 0) {
    throw new Error(
      'No GitHub Copilot language models found. Please make sure GitHub Copilot is installed and signed in.'
    );
  }

  const selectedModel =
    models.find((m) => m.family.toLowerCase().includes(preferredFamily.toLowerCase())) ||
    models.find((m) => m.family.toLowerCase().includes('gpt-4')) ||
    models[0];

  const messages = [vscode.LanguageModelChatMessage.User(prompt)];
  const response = await selectedModel.sendRequest(messages, {}, cancellationToken);

  let text = '';
  for await (const chunk of response.text) {
    text += chunk;
  }

  return text.trim();
}
