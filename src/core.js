// Pure logic for iExternal Libraries. No `vscode` import, so it runs in plain Node unit tests.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

/**
 * Absolute path for a stored include path: expands `~` and resolves relative paths against `base`.
 * @param {string} stored
 * @param {string} base
 * @param {string} [home]
 */
const expandPath = (stored, base, home = os.homedir()) => {
  const p = stored.trim();
  const expanded = p === '~' || /^~[\\/]/.test(p) ? path.join(home, p.slice(1)) : p;
  return path.resolve(base, expanded);
};

/**
 * Portable form for settings: paths inside the home folder become `~/…` (like PhpStorm's $USER_HOME$), so a
 * committed .vscode/settings.json works for everyone.
 * @param {string} absolute
 * @param {string} [home]
 */
const contractPath = (absolute, home = os.homedir()) => {
  const rel = path.relative(home, absolute);
  if (rel === '') return '~';
  if (rel.startsWith('..') || path.isAbsolute(rel)) return absolute;
  return `~/${rel.split(path.sep).join('/')}`;
};

/**
 * User input → absolute path: trims spaces and surrounding quotes (pasted from a terminal), then expands.
 * @param {string} input
 * @param {string} base
 */
const resolveInput = (input, base) => expandPath(input.trim().replace(/^(["'])(.*)\1$/, '$2'), base);

/**
 * Include paths from PhpStorm's .idea/php.xml (`<include_path><path value="…"/></include_path>`), with the
 * $USER_HOME$ and $PROJECT_DIR$ macros expanded.
 * @param {string} xml
 * @param {string} projectDir
 * @param {string} [home]
 * @returns {string[]}
 */
const parsePhpStormIncludePaths = (xml, projectDir, home = os.homedir()) => {
  const block = /<include_path>([\s\S]*?)<\/include_path>/.exec(xml)?.[1] ?? '';
  return [...block.matchAll(/<path\s+value="([^"]*)"/g)]
    .map((m) => m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
    .map((v) => v.replace(/\$USER_HOME\$/g, home).replace(/\$PROJECT_DIR\$/g, projectDir))
    .filter(Boolean)
    .map((v) => path.resolve(projectDir, v));
};

/**
 * Next value of another tool's include-path setting: the user's own entries are kept, entries this extension added
 * before (`managed`) are replaced by `ours`.
 * @param {readonly string[]} current
 * @param {readonly string[]} managed
 * @param {readonly string[]} ours
 */
const mergeManaged = (current, managed, ours) => {
  const mine = new Set(managed);
  return [...new Set([...current.filter((p) => !mine.has(p)), ...ours])];
};

/** @typedef {{ name: string, path: string, isDirectory: boolean }} Entry */

/**
 * Directory entries, folders first, then case-insensitive natural order. Symlinks are followed; broken ones are
 * listed as files.
 * @param {string} dir
 * @returns {Promise<Entry[]>}
 */
const listDirectory = async (dir) => {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const entries = await Promise.all(
    dirents.map(async (d) => {
      const full = path.join(dir, d.name);
      const isDirectory = d.isDirectory() || (d.isSymbolicLink() && (await fs.stat(full).then((s) => s.isDirectory(), () => false)));
      return { name: d.name, path: full, isDirectory };
    }),
  );
  const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
  return entries.sort((a, b) => Number(b.isDirectory) - Number(a.isDirectory) || collator.compare(a.name, b.name));
};

/** @param {string} p */
const isDirectory = (p) => fs.stat(p).then((s) => s.isDirectory(), () => false);

module.exports = { expandPath, contractPath, resolveInput, parsePhpStormIncludePaths, mergeManaged, listDirectory, isDirectory };
