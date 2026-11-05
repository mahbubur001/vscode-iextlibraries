const fs = require('node:fs/promises');
const path = require('node:path');
const vscode = require('vscode');
const { isDirectory, parsePhpStormIncludePaths, resolveInput } = require('./core');
const { LibraryStore } = require('./libraries');
const { LibraryTree } = require('./tree');

const VIEW_ID = 'iextlibraries.libraries';

/** PhpStorm's .idea/php.xml in a workspace folder, if any. */
const phpStormConfigs = async () => {
  /** @type {{ folder: vscode.WorkspaceFolder, file: string }[]} */
  const found = [];
  for (const folder of vscode.workspace.workspaceFolders ?? []) {
    const file = path.join(folder.uri.fsPath, '.idea', 'php.xml');
    if (await fs.access(file).then(() => true, () => false)) found.push({ folder, file });
  }
  return found;
};

/**
 * @param {LibraryStore} store
 * @param {readonly string[]} paths
 */
const addPaths = async (store, paths) => {
  const added = await store.add(paths);
  if (added === 0) void vscode.window.showInformationMessage('Already in External Libraries.');
  else await vscode.commands.executeCommand(`${VIEW_ID}.focus`);
};

/** @param {LibraryStore} store */
const addLibrary = async (store) => {
  if (!vscode.workspace.workspaceFolders?.length) {
    void vscode.window.showErrorMessage('Open a folder first: external libraries belong to a workspace.');
    return;
  }
  const choice = await vscode.window.showQuickPick(
    [
      { label: '$(folder-opened) Choose Folders…', description: 'pick one or more folders', pick: 'browse' },
      { label: '$(edit) Enter a Path…', description: 'absolute, ~/…, or relative to the workspace', pick: 'path' },
    ],
    { title: 'Add External Library', placeHolder: 'Folders outside the project to index for completion and navigation' },
  );
  if (!choice) return;
  if (choice.pick === 'browse') {
    const uris = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: true, openLabel: 'Add to External Libraries' });
    if (uris?.length) await addPaths(store, uris.map((u) => u.fsPath));
    return;
  }
  const input = await vscode.window.showInputBox({
    title: 'Add External Library',
    prompt: 'Folder path',
    placeHolder: '~/code/wordpress',
    ignoreFocusOut: true,
    validateInput: async (value) => (!value.trim() || (await isDirectory(resolveInput(value, store.base))) ? undefined : 'No folder at this path.'),
  });
  if (input?.trim()) await addPaths(store, [resolveInput(input, store.base)]);
};

/** @param {LibraryStore} store */
const importPhpStorm = async (store) => {
  const configs = await phpStormConfigs();
  const lists = await Promise.all(
    configs.map(({ folder, file }) => fs.readFile(file, 'utf8').then((xml) => parsePhpStormIncludePaths(xml, folder.uri.fsPath), () => [])),
  );
  const all = lists.flat();
  if (all.length === 0) {
    void vscode.window.showInformationMessage(configs.length ? 'No include paths in .idea/php.xml.' : 'No PhpStorm project (.idea/php.xml) in this workspace.');
    return;
  }
  const added = await store.add(all);
  void vscode.window.showInformationMessage(
    added ? `Imported ${added} include path${added === 1 ? '' : 's'} from PhpStorm.` : 'All PhpStorm include paths are already in External Libraries.',
  );
};

/**
 * Library node passed by a view context menu, or the user picks one.
 * @param {LibraryStore} store
 * @param {{ path: string } | undefined} node
 */
const pickLibrary = async (store, node) => {
  if (node) return node.path;
  const items = store.libraries.map((l) => ({ label: path.basename(l.path), description: l.stored, path: l.path }));
  if (items.length === 0) return undefined;
  return (await vscode.window.showQuickPick(items, { title: 'Remove External Library' }))?.path;
};

/**
 * @param {vscode.ExtensionContext} context
 * @returns {{ store: LibraryStore, tree: LibraryTree }} exposed for the end-to-end tests
 */
function activate(context) {
  const store = new LibraryStore(context.workspaceState);
  const tree = new LibraryTree(store);
  const view = vscode.window.createTreeView(VIEW_ID, { treeDataProvider: tree, showCollapseAll: true });

  const updateContext = async () => {
    await vscode.commands.executeCommand('setContext', 'iextlibraries.hasPhpStormProject', (await phpStormConfigs()).length > 0);
  };

  context.subscriptions.push(
    store,
    tree,
    view,
    vscode.workspace.onDidChangeWorkspaceFolders(() => void updateContext()),
    vscode.commands.registerCommand('iextlibraries.add', () => addLibrary(store)),
    vscode.commands.registerCommand('iextlibraries.importPhpStorm', () => importPhpStorm(store)),
    vscode.commands.registerCommand('iextlibraries.refresh', () => tree.refresh()),
    vscode.commands.registerCommand('iextlibraries.configure', () => vscode.commands.executeCommand('workbench.action.openWorkspaceSettings', `@ext:itemcoder.iextlibraries`)),
    vscode.commands.registerCommand('iextlibraries.remove', async (/** @type {{ path: string } | undefined} */ node) => {
      const target = await pickLibrary(store, node);
      if (target) await store.remove(target);
    }),
    vscode.commands.registerCommand('iextlibraries.revealInOS', (/** @type {{ path: string }} */ node) =>
      vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(node.path)),
    ),
    vscode.commands.registerCommand('iextlibraries.copyPath', (/** @type {{ path: string }} */ node) => vscode.env.clipboard.writeText(node.path)),
  );
  void updateContext();
  void store.syncIntelephense();
  return { store, tree };
}

function deactivate() {}

module.exports = { activate, deactivate };
