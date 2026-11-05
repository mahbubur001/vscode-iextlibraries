const vscode = require('vscode');
const { contractPath, expandPath, mergeManaged } = require('./core');

const SECTION = 'iextlibraries';
const INTELEPHENSE_ID = 'bmewburn.vscode-intelephense-client';
const MANAGED_KEY = 'iextlibraries.intelephenseManaged';

/** @returns {string[]} */
const storedPaths = () => /** @type {string[]} */ (vscode.workspace.getConfiguration(SECTION).get('includePaths', []));

/** @typedef {{ stored: string, path: string }} Library */

/**
 * The include-path list (PhpStorm: Settings → PHP → Include Path), stored in the workspace settings as
 * `iextlibraries.includePaths`, and its mirror in Intelephense's `intelephense.environment.includePaths`.
 */
class LibraryStore {
  /** @param {vscode.Memento} state workspace state, remembers which Intelephense entries this extension added */
  constructor(state) {
    this.state = state;
    /** @type {vscode.EventEmitter<void>} */
    this.emitter = new vscode.EventEmitter();
    this.onDidChange = this.emitter.event;
    this.disposables = [
      this.emitter,
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (!e.affectsConfiguration(`${SECTION}.includePaths`) && !e.affectsConfiguration(`${SECTION}.intelephense`)) return;
        this.emitter.fire();
        void this.syncIntelephense();
      }),
      vscode.extensions.onDidChange(() => void this.syncIntelephense()),
    ];
  }

  /** Relative paths are resolved against the first workspace folder. */
  get base() {
    return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
  }

  /** @returns {Library[]} */
  get libraries() {
    const seen = new Set();
    return storedPaths()
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => ({ stored: s, path: expandPath(s, this.base) }))
      .filter((l) => !seen.has(l.path) && seen.add(l.path));
  }

  /** @param {readonly string[]} absolutePaths */
  async add(absolutePaths) {
    const current = storedPaths();
    const known = new Set(this.libraries.map((l) => l.path));
    const added = absolutePaths.filter((p) => !known.has(p) && known.add(p));
    if (added.length === 0) return 0;
    await this.write([...current, ...added.map((p) => contractPath(p))]);
    return added.length;
  }

  /** @param {string} absolutePath */
  async remove(absolutePath) {
    await this.write(this.libraries.filter((l) => l.path !== absolutePath).map((l) => l.stored));
  }

  /** @param {string[]} paths */
  async write(paths) {
    await vscode.workspace.getConfiguration(SECTION).update('includePaths', paths, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Mirrors the libraries into Intelephense so completion and Go to Definition index them. Entries the user added to
   * Intelephense themselves are kept; only entries this extension added before are replaced.
   */
  async syncIntelephense() {
    if (!vscode.workspace.workspaceFolders?.length) return;
    if (!vscode.workspace.getConfiguration(SECTION).get('intelephense.sync', true)) return;
    if (!vscode.extensions.getExtension(INTELEPHENSE_ID)) return;
    const config = vscode.workspace.getConfiguration('intelephense.environment');
    const current = config.inspect('includePaths')?.workspaceValue;
    const currentList = Array.isArray(current) ? current.filter((p) => typeof p === 'string') : [];
    const managed = this.state.get(MANAGED_KEY, /** @type {string[]} */ ([]));
    const ours = this.libraries.map((l) => l.path);
    const next = mergeManaged(currentList, managed, ours);
    await this.state.update(MANAGED_KEY, ours);
    if (next.length === currentList.length && next.every((p, i) => p === currentList[i])) return;
    // An emptied list is removed instead of leaving "includePaths": [] behind.
    await config.update('includePaths', next.length ? next : undefined, vscode.ConfigurationTarget.Workspace);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}

module.exports = { LibraryStore, SECTION, INTELEPHENSE_ID };
