import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { isAntigravity } from '../detector';

/**
 * In Antigravity IDE, `.quick-input-inline-action-bar` has `margin: auto 0;`,
 * which vertically centers action buttons across the combined height of the
 * text input box AND the prompt text below it, dragging the sparkle icon down.
 *
 * This function ensures the action bar is aligned with the 36px input box
 * so the generate button is vertically centered with the text field.
 */
export function ensureAntigravityButtonAlignment(): void {
  if (!isAntigravity()) {
    return;
  }

  try {
    const appRoot = vscode.env.appRoot;
    if (!appRoot) return;

    const cssPath = path.join(appRoot, 'out', 'vs', 'workbench', 'workbench.desktop.main.css');
    if (!fs.existsSync(cssPath)) return;

    let css = fs.readFileSync(cssPath, 'utf8');
    const oldRule = '.quick-input-inline-action-bar{margin:auto 0}';
    const fixedRule =
      '.quick-input-inline-action-bar{align-self:flex-start;height:36px;display:flex;align-items:center;margin:0}';

    if (css.includes(oldRule)) {
      css = css.replace(oldRule, fixedRule);
      fs.writeFileSync(cssPath, css, 'utf8');
    }
  } catch (err) {
    console.warn('[Branch Assistant] Note on CSS alignment:', err);
  }
}
