import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface GitContext {
  repoRoot: string;
  currentBranch: string;
  stagedDiff: string;
  workingDiff: string;
  commitMessage: string;
  existingBranches: string[];
  branchPrefix: string;
}

/**
 * Retrieves the Git extension API.
 */
export async function getGitAPI(): Promise<any | undefined> {
  const extension = vscode.extensions.getExtension('vscode.git');
  if (!extension) {
    return undefined;
  }
  if (!extension.isActive) {
    await extension.activate();
  }
  return extension.exports.getAPI(1);
}

/**
 * Finds the most relevant active Git repository.
 */
export async function getActiveRepository(): Promise<any | undefined> {
  const gitAPI = await getGitAPI();
  if (!gitAPI || gitAPI.repositories.length === 0) {
    return undefined;
  }

  // If only 1 repository is open, return it directly
  if (gitAPI.repositories.length === 1) {
    return gitAPI.repositories[0];
  }

  // Check active text editor
  const activeUri = vscode.window.activeTextEditor?.document.uri;
  if (activeUri) {
    const repo = gitAPI.getRepository(activeUri);
    if (repo) {
      return repo;
    }
  }

  // Fallback to first repository
  return gitAPI.repositories[0];
}

/**
 * Extracts Git diff, active branch, commit message, and existing refs.
 */
export async function collectGitContext(repo?: any): Promise<GitContext | undefined> {
  const targetRepo = repo || (await getActiveRepository());
  if (!targetRepo) {
    return undefined;
  }

  const repoRoot = targetRepo.rootUri?.fsPath;
  if (!repoRoot) {
    return undefined;
  }

  const currentBranch = targetRepo.state?.HEAD?.name || 'HEAD';
  const commitMessage = targetRepo.inputBox?.value?.trim() || '';

  // Get existing branches to prevent naming conflicts
  let existingBranches: string[] = [];
  try {
    const refs = await targetRepo.getRefs({ pattern: 'refs/heads' });
    existingBranches = refs.map((r: any) => r.name).filter(Boolean);
  } catch {
    // Non-critical if getRefs fails
  }

  // Check prefix from branchAssistant setting or git.branchPrefix
  const branchAssistantConfig = vscode.workspace.getConfiguration('branchAssistant', targetRepo.rootUri);
  const gitConfig = vscode.workspace.getConfiguration('git', targetRepo.rootUri);
  const branchPrefix =
    branchAssistantConfig.get<string>('branchPrefix') ||
    gitConfig.get<string>('branchPrefix', '') ||
    '';

  // Read git diffs (both staged and unstaged)
  let stagedDiff = '';
  let workingDiff = '';

  try {
    // Try using git CLI for complete diff output
    const { stdout: stagedOut } = await execFileAsync('git', ['diff', '--cached', '--stat', '-p', '--minimal'], {
      cwd: repoRoot,
      maxBuffer: 1024 * 512,
    });
    stagedDiff = stagedOut;
  } catch {
    // Fallback using vscode.git API if CLI execution fails
    try {
      if (typeof targetRepo.diff === 'function') {
        stagedDiff = await targetRepo.diff(true);
      }
    } catch {
      // Ignored
    }
  }

  try {
    const { stdout: workingOut } = await execFileAsync('git', ['diff', '--stat', '-p', '--minimal'], {
      cwd: repoRoot,
      maxBuffer: 1024 * 512,
    });
    workingDiff = workingOut;
  } catch {
    try {
      if (typeof targetRepo.diff === 'function') {
        workingDiff = await targetRepo.diff(false);
      }
    } catch {
      // Ignored
    }
  }

  return {
    repoRoot,
    currentBranch,
    stagedDiff: stagedDiff.trim(),
    workingDiff: workingDiff.trim(),
    commitMessage,
    existingBranches,
    branchPrefix,
  };
}

/**
 * Creates and checks out a new branch in the given repository.
 */
export async function createAndCheckoutBranch(repo: any, branchName: string): Promise<void> {
  if (typeof repo.branch === 'function') {
    // Built-in vscode.git branch method (checkout = true)
    await repo.branch(branchName, true);
  } else if (typeof repo.createBranch === 'function') {
    await repo.createBranch(branchName, true);
  } else {
    // CLI fallback
    const repoRoot = repo.rootUri?.fsPath;
    await execFileAsync('git', ['checkout', '-b', branchName], { cwd: repoRoot });
  }
}

/**
 * Commits changes in the repository.
 */
export async function commitChanges(repo: any, message: string): Promise<void> {
  if (typeof repo.commit === 'function') {
    await repo.commit(message);
  } else {
    const repoRoot = repo.rootUri?.fsPath;
    await execFileAsync('git', ['commit', '-m', message], { cwd: repoRoot });
  }
}

/**
 * Checks if the branch is configured as protected.
 */
export function isBranchProtected(repo: any, branchName?: string): boolean {
  if (typeof repo?.isBranchProtected === 'function') {
    return repo.isBranchProtected(branchName ? { name: branchName } : undefined);
  }

  const name = branchName || repo?.state?.HEAD?.name;
  if (!name) return false;

  const gitConfig = vscode.workspace.getConfiguration('git', repo?.rootUri);
  const protectedBranches = gitConfig.get<string[]>('branchProtection', []);
  return protectedBranches.includes(name);
}
