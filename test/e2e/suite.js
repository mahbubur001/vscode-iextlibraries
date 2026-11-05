// Runs inside VS Code. Dialogs are replaced with scripted answers, then the real commands are executed.
const assert = require('node:assert/strict');
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

/**
 * @param {string} command
 * @param {...unknown} args
 * @returns {Promise<void>}
 */
const run = async (command, ...args) => {
  await vscode.commands.executeCommand(command, ...args);
};

/** Configuration updates are applied asynchronously. */
const settled = () => new Promise((r) => setTimeout(r, 300));

const stored = () => vscode.workspace.getConfiguration('iextlibraries').get('includePaths');

module.exports.run = async () => {
  const wordpress = /** @type {string} */ (process.env.IEXT_E2E_WORDPRESS);
  const sdk = /** @type {string} */ (process.env.IEXT_E2E_SDK);
  const ext = /** @type {vscode.Extension<{ store: import('../../src/libraries').LibraryStore, tree: import('../../src/tree').LibraryTree }>} */ (
    vscode.extensions.getExtension('itemcoder.iextlibraries')
  );
  assert.ok(ext, 'extension is installed');
  const { store, tree } = await ext.activate();
  /** @type {string[]} */
  const infos = [];
  const info = async (/** @type {string} */ m) => (infos.push(m), undefined);

  // 1. Import from .idea/php.xml ($PROJECT_DIR$/../wordpress).
  await withDialogs({ showInformationMessage: info }, () => run('iextlibraries.importPhpStorm'));
  await settled();
  assert.deepEqual(store.libraries.map((l) => l.path), [wordpress]);
  assert.match(infos.pop() ?? '', /Imported 1 include path/);

  // 2. The tree shows the library and its contents, folders first.
  const roots = await tree.getChildren();
  assert.equal(roots.length, 1);
  const rootItem = tree.getTreeItem(roots[0]);
  assert.equal(rootItem.label, 'wordpress');
  assert.equal(rootItem.contextValue, 'library');
  const children = await tree.getChildren(roots[0]);
  assert.deepEqual(children.map((c) => path.basename(c.path)), ['wp-includes', 'index.php']);
  const fileItem = tree.getTreeItem(children[1]);
  assert.equal(fileItem.command?.command, 'vscode.open', 'files open on click');

  // 3. Add by path; adding the same folder again is refused.
  const addByPath = { showQuickPick: async (/** @type {{ pick: string }[]} */ items) => items.find((i) => i.pick === 'path'), showInputBox: async () => sdk };
  await withDialogs(addByPath, () => run('iextlibraries.add'));
  await settled();
  assert.deepEqual(store.libraries.map((l) => l.path), [wordpress, sdk]);
  await withDialogs({ ...addByPath, showInformationMessage: info }, () => run('iextlibraries.add'));
  await settled();
  assert.equal(store.libraries.length, 2);
  assert.match(infos.pop() ?? '', /Already in External Libraries/);

  // 4. Remove from the view's context menu.
  await run('iextlibraries.remove', { kind: 'library', path: wordpress, missing: false });
  await settled();
  assert.deepEqual(store.libraries.map((l) => l.path), [sdk]);
  assert.deepEqual(stored(), store.libraries.map((l) => l.stored));

  await store.write([]);
  console.log('iExternal libraries e2e: all checks passed');
};
