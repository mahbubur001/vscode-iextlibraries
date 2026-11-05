const path = require('node:path');
const vscode = require('vscode');
const { contractPath, isDirectory, listDirectory } = require('./core');

/**
 * @typedef {{ kind: 'library', path: string, missing: boolean }} LibraryNode
 * @typedef {{ kind: 'entry', path: string, isDirectory: boolean }} EntryNode
 * @typedef {LibraryNode | EntryNode} Node
 */

/**
 * The "External Libraries" view in the Explorer — PhpStorm's External Libraries node: one root per include path,
 * browsable like any folder, files open in the editor.
 * @implements {vscode.TreeDataProvider<Node>}
 */
class LibraryTree {
  /** @param {import('./libraries').LibraryStore} store */
  constructor(store) {
    this.store = store;
    /** @type {vscode.EventEmitter<Node | undefined>} */
    this.emitter = new vscode.EventEmitter();
    this.onDidChangeTreeData = this.emitter.event;
    /** @type {vscode.Disposable[]} */
    this.watchers = [];
    this.disposables = [this.emitter, store.onDidChange(() => this.refresh())];
    this.watch();
  }

  refresh() {
    this.watch();
    this.emitter.fire(undefined);
  }

  /** Refreshes the view when files change inside a library (debounced; libraries are outside the workspace). */
  watch() {
    this.watchers.forEach((w) => w.dispose());
    /** @type {NodeJS.Timeout | undefined} */
    let timer;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => this.emitter.fire(undefined), 500);
    };
    this.watchers = this.store.libraries.map((l) => {
      const w = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(l.path), '**/*'));
      w.onDidCreate(schedule);
      w.onDidDelete(schedule);
      return w;
    });
  }

  /**
   * @param {Node} [node]
   * @returns {Promise<Node[]>}
   */
  async getChildren(node) {
    if (!node) {
      return Promise.all(this.store.libraries.map(async (l) => ({ kind: /** @type {const} */ ('library'), path: l.path, missing: !(await isDirectory(l.path)) })));
    }
    if (node.kind === 'library' && node.missing) return [];
    const entries = await listDirectory(node.path).catch(() => []);
    return entries.map((e) => ({ kind: /** @type {const} */ ('entry'), path: e.path, isDirectory: e.isDirectory }));
  }

  /**
   * @param {Node} node
   * @returns {vscode.TreeItem}
   */
  getTreeItem(node) {
    const uri = vscode.Uri.file(node.path);
    if (node.kind === 'library') {
      const item = new vscode.TreeItem(path.basename(node.path) || node.path, node.missing ? vscode.TreeItemCollapsibleState.None : vscode.TreeItemCollapsibleState.Collapsed);
      item.description = node.missing ? 'not found' : contractPath(path.dirname(node.path));
      item.tooltip = new vscode.MarkdownString(node.missing ? `**${node.path}**\n\nThis folder does not exist.` : `**${node.path}**`);
      item.iconPath = new vscode.ThemeIcon(node.missing ? 'warning' : 'library', node.missing ? new vscode.ThemeColor('list.warningForeground') : undefined);
      item.contextValue = 'library';
      item.resourceUri = uri;
      item.id = `library:${node.path}`;
      return item;
    }
    const item = new vscode.TreeItem(uri, node.isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    item.contextValue = node.isDirectory ? 'libraryFolder' : 'libraryFile';
    item.id = `entry:${node.path}`;
    if (!node.isDirectory) item.command = { command: 'vscode.open', title: 'Open', arguments: [uri] };
    return item;
  }

  dispose() {
    this.watchers.forEach((w) => w.dispose());
    this.disposables.forEach((d) => d.dispose());
  }
}

module.exports = { LibraryTree };
