# Branch Assistant

[![Visual Studio Marketplace](https://img.shields.io/badge/VS%20Code-Marketplace-blue.svg)](https://marketplace.visualstudio.com)
[![Open VSX](https://img.shields.io/badge/Open%20VSX-Registry-purple.svg)](https://open-vsx.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Intelligent, context-aware Git branch name generator for Antigravity & VS Code.**

Tired of context-switching when committing on a protected branch like `main` or `dev`? **Branch Assistant** embeds an AI generate button directly into your Git branch naming input pop-up. It analyzes your staged and unstaged code changes (and commit message intent) to generate clean, conventional branch names in one click.

---

## Features

- **Inline Generate Button**: Sits right on the right side of the branch naming input box (`✨` in Antigravity, `🤖` in VS Code).
- **Native Antigravity Gemini Support**: Directly leverages Antigravity's built-in Git language server pipeline—zero API keys or cloud configuration required.
- **Native GitHub Copilot Support**: Directly invokes GitHub Copilot's official Git pipeline and `vscode.lm` Language Model API.
- **Protected Branch Commits**: When committing on a protected branch and clicking *"Commit to a New Branch"*, the input box is automatically enhanced with the AI generate button.
- **Diff & Intent Aware**: Analyzes git diffs and any commit message intent already typed into your Source Control box to generate concise, conventional branch names (e.g., `feat/jwt-auth-validation`, `fix/motor-timeout-retry`).
- **Convention & Prefix Respect**: Automatically honors your `git.branchPrefix` (e.g. `feature/` or `users/sven/`) and repository regex rules.
- **Double Win (SCM Integration)**: By default, generates both the branch name and leaves the matching commit message in the Source Control box so you can commit immediately. Can be configured to leave the box clean.

---

## How It Works

### 1. In Antigravity (Gemini)
```text
┌────────────────────────────────────────────────────────────────────────┐
│ Please provide a new branch name                                       │
│ > [                                                                 ✨ ] │
└────────────────────────────────────────────────────────────────────────┘
```
1. Click the `✨` generate button inside the input pop-up.
2. The button transforms into an active spinner `🔄` while inspecting changes.
3. Antigravity's native Gemini Git engine generates the branch name and populates the field:
```text
┌────────────────────────────────────────────────────────────────────────┐
│ Please provide a new branch name                                       │
│ > [ feat/jwt-auth-validation                                        ✨ ] │
│   ℹ The new branch will be "feat/jwt-auth-validation"                  │
└────────────────────────────────────────────────────────────────────────┘
```
4. Press <kbd>Enter</kbd> to accept and switch to the new branch!

### 2. In VS Code (GitHub Copilot)
```text
┌────────────────────────────────────────────────────────────────────────┐
│ Please provide a new branch name                                       │
│ > [                                                                 🤖 ] │
└────────────────────────────────────────────────────────────────────────┘
```
Automatically detects standard VS Code and routes through your active GitHub Copilot subscription using the Copilot `🤖` icon.

---

## Configuration

Open your VS Code / Antigravity Settings (<kbd>Ctrl+,</kbd>) and search for `Branch Assistant`:

| Setting | Type | Default | Description |
| :--- | :---: | :---: | :--- |
| `branchAssistant.provider` | `enum` | `"auto"` | `"auto"` (Gemini in Antigravity, Copilot in VS Code), `"gemini"`, or `"copilot"`. |
| `branchAssistant.icon` | `enum` | `"auto"` | `"auto"` (`$(sparkle)` in Antigravity, `$(copilot)` in VS Code), `"sparkle"`, or `"copilot"`. |
| `branchAssistant.convention` | `enum` | `"conventional"` | `"conventional"` (`feat/`, `fix/`, `chore/`), or `"short"` (simple hyphenated). |
| `branchAssistant.branchPrefix` | `string` | `""` | Custom prefix (e.g. `"feature/"`). If empty, inherits from `git.branchPrefix`. |
| `branchAssistant.populateCommitMessage` | `boolean` | `true` | Retain the AI-generated commit message in the SCM box. Set to `false` to keep it clean. |
| `branchAssistant.interceptNativeGitPrompt` | `boolean` | `true` | Automatically attach the button to VS Code's native Git branch input box. |
| `branchAssistant.copilotModelFamily` | `string` | `"gpt-4o"` | Preferred Copilot model family in VS Code. |

---

## Commands

- **`Branch Assistant: Create Branch with AI...`** (`branch-assistant.createBranch`): Opens the branch input box with the generate button and switches to the new branch. Also accessible via the Source Control title bar icon.
- **`Branch Assistant: Commit to New Branch...`** (`branch-assistant.commitToNewBranch`): Prompts for a branch name with AI, switches to it, and commits your changes in one seamless step.
- **`Branch Assistant: Generate Branch Name for Active Changes`** (`branch-assistant.generateBranchName`): Generates a branch name and copies it directly to your clipboard.

---

## Development & Building

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Bundle with esbuild
npm run build

# Package into VSIX
npx @vscode/vsce package
```

---

## License

[MIT](LICENSE) © 2026 Sven Jansen
