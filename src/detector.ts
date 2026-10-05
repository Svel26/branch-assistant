import * as vscode from 'vscode';

export type AIProvider = 'copilot' | 'gemini';

export interface ProviderInfo {
  provider: AIProvider;
  icon: vscode.ThemeIcon;
  tooltip: string;
  isAntigravity: boolean;
}

/**
 * Checks whether the current IDE is Google Antigravity.
 */
export function isAntigravity(): boolean {
  const appName = vscode.env.appName || '';
  return appName.toLowerCase().includes('antigravity');
}

/**
 * Resolves the active AI provider and visual elements based on configuration and host environment.
 */
export function resolveProviderInfo(): ProviderInfo {
  const config = vscode.workspace.getConfiguration('branchAssistant');
  const configuredProvider = config.get<string>('provider', 'auto');
  const configuredIcon = config.get<string>('icon', 'auto');

  const antigravity = isAntigravity();

  let provider: AIProvider;
  if (configuredProvider === 'copilot') {
    provider = 'copilot';
  } else if (configuredProvider === 'gemini') {
    provider = 'gemini';
  } else {
    // Auto detection: In Antigravity use Gemini, otherwise default to GitHub Copilot
    provider = antigravity ? 'gemini' : 'copilot';
  }

  // Resolve icon
  let iconName: string;
  if (configuredIcon === 'sparkle') {
    iconName = 'sparkle';
  } else if (configuredIcon === 'copilot') {
    iconName = 'copilot';
  } else {
    // Auto: In Antigravity use sparkle (native Gemini/Antigravity symbol), in VS Code use copilot if available
    iconName = provider === 'copilot' ? 'copilot' : 'sparkle';
  }

  const tooltip =
    provider === 'copilot'
      ? 'Generate Branch Name with GitHub Copilot'
      : 'Generate Branch Name with Gemini';

  return {
    provider,
    icon: new vscode.ThemeIcon(iconName),
    tooltip,
    isAntigravity: antigravity,
  };
}
