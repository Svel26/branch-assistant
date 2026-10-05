import * as vscode from 'vscode';
import { resolveProviderInfo } from '../detector';
import { collectGitContext } from '../git';
import { generateBranchName } from '../ai/manager';

interface ExtendedInputBox extends vscode.InputBox {
  _branchAssistantInjected?: boolean;
}

/**
 * Registers an interceptor on VS Code's InputBox prototype so that the native
 * Git branch naming prompt (e.g. from the protected branch commit dialog or
 * status bar) automatically includes the AI generate button on the right side.
 */
export function registerNativePromptInterceptor(context: vscode.ExtensionContext): void {
  try {
    const sample = vscode.window.createInputBox();
    const proto = Object.getPrototypeOf(sample);
    sample.dispose();

    if (!proto || typeof proto.show !== 'function') {
      return;
    }

    const origShow = proto.show;

    proto.show = function (this: ExtendedInputBox) {
      const config = vscode.workspace.getConfiguration('branchAssistant');
      const interceptEnabled = config.get<boolean>('interceptNativeGitPrompt', true);

      if (interceptEnabled && !this._branchAssistantInjected) {
        const placeholder = this.placeholder?.toLowerCase() || '';
        const prompt = this.prompt?.toLowerCase() || '';

        const isBranchPrompt =
          placeholder === 'branch name' ||
          prompt.includes('branch name') ||
          prompt.includes('provide a new branch name');

        if (isBranchPrompt) {
          this._branchAssistantInjected = true;
          attachAIButtonToInputBox(this, context);
        }
      }

      return origShow.apply(this, arguments);
    };

    context.subscriptions.push({
      dispose: () => {
        proto.show = origShow;
      },
    });
  } catch (err) {
    console.warn('[Branch Assistant] Failed to install native prompt interceptor:', err);
  }
}

/**
 * Attaches the AI generate button and click handler to an existing InputBox.
 */
function attachAIButtonToInputBox(inputBox: vscode.InputBox, context: vscode.ExtensionContext): void {
  const providerInfo = resolveProviderInfo();

  const aiButton: vscode.QuickInputButton = {
    iconPath: providerInfo.icon,
    tooltip: providerInfo.tooltip,
    location: vscode.QuickInputButtonLocation.Inline,
  };

  const loadingButton: vscode.QuickInputButton = {
    iconPath: new vscode.ThemeIcon('loading~spin'),
    tooltip: 'Generating branch name...',
    location: vscode.QuickInputButtonLocation.Inline,
  };

  // Add the button if not already present
  const currentButtons = inputBox.buttons || [];
  const alreadyHasButton = currentButtons.some(
    (b) => b.tooltip === aiButton.tooltip || (b.iconPath as any)?.id === 'sparkle' || (b.iconPath as any)?.id === 'copilot'
  );

  if (!alreadyHasButton) {
    inputBox.buttons = [...currentButtons, aiButton];
  }

  let isGenerating = false;

  const btnListener = inputBox.onDidTriggerButton(async (btn) => {
    if (btn !== aiButton || isGenerating) {
      return;
    }

    isGenerating = true;
    const baseButtons = (inputBox.buttons || []).filter((b) => b !== aiButton);
    inputBox.buttons = [...baseButtons, loadingButton];
    inputBox.busy = true;

    try {
      const gitContext = await collectGitContext();
      if (!gitContext) {
        throw new Error('No active Git repository detected.');
      }

      const generatedName = await generateBranchName(gitContext);
      inputBox.value = generatedName;

      // Select text so pressing Enter accepts immediately or typing replaces it
      const prefix = gitContext.branchPrefix || '';
      const selectStart = prefix && generatedName.startsWith(prefix) ? prefix.length : 0;
      inputBox.valueSelection = [selectStart, generatedName.length];
    } catch (err: any) {
      vscode.window.showErrorMessage(`Branch Assistant: ${err.message || err}`);
    } finally {
      isGenerating = false;
      inputBox.buttons = [...baseButtons, aiButton];
      inputBox.busy = false;
    }
  });

  context.subscriptions.push(btnListener);
}
