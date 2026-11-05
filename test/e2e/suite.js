// Runs inside VS Code. Dialogs are replaced with scripted answers, then the real command is executed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

/**
 * @param {Record<string, unknown>} answers window functions to replace
 * @param {() => Promise<void>} fn
 */
const withDialogs = async (answers, fn) => {
  const win = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (vscode.window));
  const saved = Object.fromEntries(Object.keys(answers).map((k) => [k, win[k]]));
  Object.assign(win, answers);
  try {
    await fn();
  } finally {
    Object.assign(win, saved);
  }
};

const run = async () => {
  const library = /** @type {string} */ (process.env.IEXT_E2E_LIBRARY);
  const folder = /** @type {vscode.WorkspaceFolder[]} */ (vscode.workspace.workspaceFolders)[0];
  const link = path.join(folder.uri.fsPath, '_ext_shared-lib');

  const ext = vscode.extensions.getExtension('itemcoder.iextlibraries');
  assert.ok(ext, 'extension is installed');
  await ext.activate();
  assert.ok((await vscode.commands.getCommands(true)).includes('iExt.addLibrary'), 'command is registered');

  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const infos = [];

  // Folder dialog, default name accepted.
  await withDialogs(
    {
      showQuickPick: async (/** @type {{ pick: string }[]} */ items) => items.find((i) => i.pick === 'folder'),
      showOpenDialog: async () => [vscode.Uri.file(library)],
      showInputBox: async (/** @type {{ value?: string }} */ o) => o.value,
      showInformationMessage: async (/** @type {string} */ m) => (infos.push(m), undefined),
      showErrorMessage: async (/** @type {string} */ m) => (errors.push(m), undefined),
    },
    async () => {
      await vscode.commands.executeCommand('iExt.addLibrary');
    },
  );
  assert.deepEqual(errors, []);
  assert.ok(fs.lstatSync(link).isSymbolicLink(), 'link was created');
  assert.equal(fs.readFileSync(path.join(link, 'src', 'helpers.php'), 'utf8'), '<?php function shared_helper() {}');
  assert.match(infos[0], /_ext_shared-lib/);

  // Same name again: the name prompt rejects it, so cancelling leaves everything untouched.
  /** @type {string | undefined} */
  let validation;
  await withDialogs(
    {
      showQuickPick: async (/** @type {{ pick: string }[]} */ items) => items.find((i) => i.pick === 'path'),
      showInputBox: async (/** @type {{ value?: string, validateInput: (v: string) => Promise<string | undefined> }} */ o) => {
        if (o.value === undefined) return library; // the path prompt
        validation = await o.validateInput(o.value);
        return undefined; // the user presses Escape
      },
    },
    async () => {
      await vscode.commands.executeCommand('iExt.addLibrary');
    },
  );
  assert.match(/** @type {string} */ (validation), /already exists/);
  console.log('iExternal libraries e2e: all checks passed');
};

module.exports = { run };
