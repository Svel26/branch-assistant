import * as vscode from 'vscode';
import { GitContext, collectGitContext } from '../git';
import { resolveProviderInfo } from '../detector';
import { generateBranchName } from '../ai/manager';

export interface BranchPromptOptions {
  repo?: any;
  title?: string;
  placeholder?: string;
  prompt?: string;
  initialValue?: string;
}

/**
 * Displays an interactive InputBox equipped with the inline AI generate button.
 */
export async function promptForBranchNameWithAI(
  options: BranchPromptOptions = {}
): Promise<string | undefined> {
  const context = await collectGitContext(options.repo);
  const gitConfig = vscode.workspace.getConfiguration('git', options.repo?.rootUri);
  const validationRegex = gitConfig.get<string>('branchValidationRegex', '');
  const whitespaceChar = gitConfig.get<string>('branchWhitespaceChar', '-');

  const providerInfo = resolveProviderInfo();

  // Create the inline AI button
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

  const inputBox = vscode.window.createInputBox();
  inputBox.title = options.title || 'Create Branch';
  inputBox.placeholder = options.placeholder || 'Branch name';
  inputBox.prompt = options.prompt || 'Please provide a new branch name';
  inputBox.ignoreFocusOut = true;
  inputBox.buttons = [aiButton];

  // Set initial value
  const prefix = context?.branchPrefix || '';
  inputBox.value = options.initialValue ?? prefix;
  if (prefix && inputBox.value.startsWith(prefix)) {
    inputBox.valueSelection = [prefix.length, inputBox.value.length];
  }

  // Validation function
  const validate = (val: string): vscode.InputBoxValidationMessage | undefined => {
    const trimmed = val.trim();
    if (!trimmed) {
      return undefined;
    }
    const sanitized = trimmed.replace(/\s+/g, whitespaceChar);
    if (context?.existingBranches.includes(sanitized)) {
      return {
        message: `Branch "${sanitized}" already exists`,
        severity: vscode.InputBoxValidationSeverity.Error,
      };
    }
    if (validationRegex) {
      const regex = new RegExp(validationRegex);
      if (!regex.test(sanitized)) {
        return {
          message: `Branch name must match regex: ${validationRegex}`,
          severity: vscode.InputBoxValidationSeverity.Error,
        };
      }
    }
    if (trimmed !== sanitized) {
      return {
        message: `The new branch will be "${sanitized}"`,
        severity: vscode.InputBoxValidationSeverity.Info,
      };
    }
    return undefined;
  };

  inputBox.validationMessage = validate(inputBox.value);

  const disposables: vscode.Disposable[] = [];

  return new Promise<string | undefined>((resolve) => {
    let isGenerating = false;

    disposables.push(
      inputBox.onDidChangeValue((val) => {
        inputBox.validationMessage = validate(val);
      })
    );

    disposables.push(
      inputBox.onDidTriggerButton(async (btn) => {
        if (isGenerating) return;

        isGenerating = true;
        inputBox.buttons = [loadingButton];
        inputBox.busy = true;

        try {
          // Re-collect context in case staged files changed
          const currentContext = (await collectGitContext(options.repo)) || context;
          if (!currentContext) {
            throw new Error('No active Git repository found to analyze.');
          }

          const generated = await generateBranchName(currentContext);
          inputBox.value = generated;

          // Select the entire generated value so typing replaces it or pressing enter accepts it
          const selectStart = prefix && generated.startsWith(prefix) ? prefix.length : 0;
          inputBox.valueSelection = [selectStart, generated.length];
          inputBox.validationMessage = validate(generated);
        } catch (err: any) {
          vscode.window.showErrorMessage(`Branch Assistant: ${err.message || err}`);
        } finally {
          isGenerating = false;
          inputBox.buttons = [aiButton];
          inputBox.busy = false;
        }
      })
    );

    disposables.push(
      inputBox.onDidAccept(() => {
        const val = inputBox.value.trim().replace(/\s+/g, whitespaceChar);
        if (!val) {
          return;
        }
        resolve(val);
        inputBox.dispose();
      })
    );

    disposables.push(
      inputBox.onDidHide(() => {
        resolve(undefined);
        inputBox.dispose();
      })
    );

    inputBox.show();
  }).finally(() => {
    disposables.forEach((d) => d.dispose());
  });
}
