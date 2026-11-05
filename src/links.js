// File-system side of iExternal libraries. No `vscode` import, so it runs in plain Node unit tests.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

/** Links are created as `<workspace folder>/_ext_<name>`; kept from 0.0.x so existing links stay recognisable. */
const PREFIX = '_ext_';

/**
 * Turns user input into an absolute path: trims spaces and surrounding quotes (paths pasted from a terminal),
 * expands `~`, and resolves relative paths against `base`.
 * @param {string} input
 * @param {string} base
 * @returns {string}
 */
const resolveSource = (input, base) => {
  const trimmed = input.trim().replace(/^(["'])(.*)\1$/, '$2');
  const expanded = trimmed === '~' || /^~[\\/]/.test(trimmed) ? path.join(os.homedir(), trimmed.slice(1)) : trimmed;
  return path.resolve(base, expanded);
};

/**
 * Last path segment, for either separator and ignoring trailing separators.
 * @param {string} source
 * @returns {string}
 */
const defaultName = (source) => source.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';

/**
 * @param {string} name
 * @returns {string | undefined} an error message, or undefined when the name is usable
 */
const validateName = (name) => {
  if (!name.trim()) return 'Enter a name.';
  if (name === '.' || name === '..' || /[\\/:*?"<>|]/.test(name)) return 'The name cannot be "." or ".." or contain \\ / : * ? " < > |';
  return undefined;
};

/**
 * @param {string} folder workspace folder
 * @param {string} name
 */
const linkPath = (folder, name) => path.join(folder, PREFIX + name);

/**
 * Whether anything (including a broken symlink) exists at `p`.
 * @param {string} p
 */
const exists = (p) => fs.lstat(p).then(
  () => true,
  () => false,
);

/**
 * Creates `link` pointing at `source`. Folders on Windows become junctions, which need no administrator rights or
 * Developer Mode (file symlinks still do).
 * @param {string} source absolute path of an existing file or folder
 * @param {string} link
 * @param {NodeJS.Platform} [platform]
 * @returns {Promise<{ isDirectory: boolean }>}
 */
const createLink = async (source, link, platform = process.platform) => {
  const stat = await fs.stat(source);
  const type = stat.isDirectory() ? (platform === 'win32' ? 'junction' : 'dir') : 'file';
  await fs.symlink(source, link, type);
  return { isDirectory: stat.isDirectory() };
};

/**
 * User-facing message for a failed link creation.
 * @param {unknown} error
 * @param {string} link
 * @param {NodeJS.Platform} [platform]
 */
const describeError = (error, link, platform = process.platform) => {
  const code = /** @type {NodeJS.ErrnoException} */ (error)?.code;
  if (code === 'EEXIST') return `${path.basename(link)} already exists.`;
  if (code === 'ENOENT') return 'The external file or folder no longer exists.';
  if ((code === 'EPERM' || code === 'EACCES') && platform === 'win32') {
    return 'Windows allows file symlinks only with Developer Mode enabled or when VS Code runs as administrator. Folders work without either.';
  }
  if (code === 'EPERM' || code === 'EACCES') return `No permission to create ${link}.`;
  return error instanceof Error ? error.message : String(error);
};

module.exports = { PREFIX, resolveSource, defaultName, validateName, linkPath, exists, createLink, describeError };
