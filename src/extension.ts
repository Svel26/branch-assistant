import * as vscode from 'vscode';
import { getActiveRepository, createAndCheckoutBranch, commitChanges, collectGitContext } from './git';
import { promptForBranchNameWithAI } from './ui/branchPrompt';
import { registerNativePromptInterceptor } from './ui/interceptor';
import { ensureAntigravityButtonAlignment } from './ui/alignment';
import { generateBranchName } from './ai/manager';

export function activate(context: vscode.ExtensionContext): void {
  // 0. Ensure pixel-perfect vertical centering in Antigravity IDE
  ensureAntigravityButtonAlignment();

  // 1. Install interceptor for VS Code's native Git branch prompt
  registerNativePromptInterceptor(context);

  // 2. Command: Create Branch with AI
  const createBranchCommand = vscode.commands.registerCommand(
    'branch-assistant.createBranch',
    async () => {
      const repo = await getActiveRepository();
      if (!repo) {
        vscode.window.showErrorMessage('Branch Assistant: No active Git repository found.');
        return;
      }

      const branchName = await promptForBranchNameWithAI({ repo });
      if (!branchName) {
        return;
      }

      try {
        await createAndCheckoutBranch(repo, branchName);
        vscode.window.showInformationMessage(`Branch Assistant: Switched to new branch "${branchName}"`);
      } catch (err: any) {
        vscode.window.showErrorMessage(`Branch Assistant: Failed to create branch: ${err.message || err}`);
      }
    }
  );

  // 3. Command: Commit to New Branch (Direct protected-branch shortcut)
  const commitToNewBranchCommand = vscode.commands.registerCommand(
    'branch-assistant.commitToNewBranch',
    async () => {
      const repo = await getActiveRepository();
      if (!repo) {
        vscode.window.showErrorMessage('Branch Assistant: No active Git repository found.');
        return;
      }

      // Check if commit message exists in SCM box
      let message = repo.inputBox?.value?.trim();
      if (!message) {
        message = await vscode.window.showInputBox({
          prompt: 'Please provide a commit message',
          placeHolder: 'Commit message',
          ignoreFocusOut: true,
        });
        if (!message) {
          return;
        }
      }

      const branchName = await promptForBranchNameWithAI({
        repo,
        title: 'Commit to New Branch',
        prompt: 'Enter or generate branch name for this commit',
      });

      if (!branchName) {
        return;
      }

      try {
        await createAndCheckoutBranch(repo, branchName);
        await commitChanges(repo, message);
        repo.inputBox.value = '';
        vscode.window.showInformationMessage(
          `Branch Assistant: Changes committed to new branch "${branchName}"`
        );
      } catch (err: any) {
        vscode.window.showErrorMessage(`Branch Assistant: Commit failed: ${err.message || err}`);
      }
    }
  );

  // 4. Command: Generate Branch Name for Active Changes (returns string or sets clipboard)
  const generateOnlyCommand = vscode.commands.registerCommand(
    'branch-assistant.generateBranchName',
    async () => {
      const gitContext = await collectGitContext();
      if (!gitContext) {
        vscode.window.showErrorMessage('Branch Assistant: No active Git repository found.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Generating branch name...',
          cancellable: false,
        },
        async () => {
          try {
            const name = await generateBranchName(gitContext);
            await vscode.env.clipboard.writeText(name);
            vscode.window.showInformationMessage(`Branch Assistant: Generated "${name}" (copied to clipboard)`);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Branch Assistant: ${err.message || err}`);
          }
        }
      );
    }
  );

  context.subscriptions.push(createBranchCommand, commitToNewBranchCommand, generateOnlyCommand);
}

export function deactivate(): void {}
