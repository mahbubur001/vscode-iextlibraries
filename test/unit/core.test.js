const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { expandPath, contractPath, resolveInput, parsePhpStormIncludePaths, mergeManaged, listDirectory, isDirectory } = require('../../src/core');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iext-'));
const home = path.join(tmp, 'home');

test('expandPath expands ~ and resolves relative paths against the workspace', () => {
  const base = path.join(tmp, 'project');
  assert.equal(expandPath('~', base, home), home);
  assert.equal(expandPath('~/libs/wp', base, home), path.join(home, 'libs', 'wp'));
  assert.equal(expandPath('../shared', base, home), path.join(tmp, 'shared'));
  assert.equal(expandPath(path.join(tmp, 'abs'), base, home), path.join(tmp, 'abs'));
});

test('contractPath stores home paths as ~/… and keeps others absolute', () => {
  assert.equal(contractPath(path.join(home, 'code', 'wordpress'), home), '~/code/wordpress');
  assert.equal(contractPath(home, home), '~');
  const outside = path.join(tmp, 'elsewhere');
  assert.equal(contractPath(outside, home), outside);
  assert.equal(expandPath(contractPath(path.join(home, 'a b', 'c'), home), tmp, home), path.join(home, 'a b', 'c'));
});

test('resolveInput strips quotes and spaces from pasted paths', () => {
  const base = path.join(tmp, 'project');
  assert.equal(resolveInput('  "../shared lib" ', base), path.join(tmp, 'shared lib'));
  assert.equal(resolveInput("'vendor'", base), path.join(base, 'vendor'));
});

test('parsePhpStormIncludePaths reads include_path entries and expands PhpStorm macros', () => {
  const project = path.join(tmp, 'project');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<project version="4">
  <component name="PhpIncludePathManager">
    <include_path>
      <path value="$USER_HOME$/Downloads/woocommerce-delivery-notes" />
      <path value="$PROJECT_DIR$/../wordpress" />
      <path value="/opt/stubs &amp; more" />
    </include_path>
  </component>
  <component name="PhpProjectSharedConfiguration" php_language_level="8.2" />
</project>`;
  assert.deepEqual(parsePhpStormIncludePaths(xml, project, home), [
    path.join(home, 'Downloads', 'woocommerce-delivery-notes'),
    path.join(tmp, 'wordpress'),
    path.resolve('/opt/stubs & more'),
  ]);
  assert.deepEqual(parsePhpStormIncludePaths('<project version="4"></project>', project, home), []);
});

test('mergeManaged keeps the user entries and replaces the ones it added before', () => {
  assert.deepEqual(mergeManaged(['/user/a', '/old/ours'], ['/old/ours'], ['/new/ours']), ['/user/a', '/new/ours']);
  assert.deepEqual(mergeManaged([], [], ['/x', '/x']), ['/x']);
  assert.deepEqual(mergeManaged(['/x'], ['/x'], []), []);
  assert.deepEqual(mergeManaged(['/x'], [], ['/x']), ['/x'], 'an entry the user already had is not duplicated');
});

test('listDirectory lists folders first in natural order and follows symlinks', async () => {
  const lib = path.join(tmp, 'lib');
  fs.mkdirSync(path.join(lib, 'src'), { recursive: true });
  fs.mkdirSync(path.join(lib, 'Assets'));
  for (const f of ['file10.php', 'file2.php', 'README.md']) fs.writeFileSync(path.join(lib, f), '');
  let linked = true;
  try {
    fs.symlinkSync(path.join(lib, 'src'), path.join(lib, 'zz-link'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch {
    linked = false;
  }
  const names = (await listDirectory(lib)).map((e) => `${e.isDirectory ? 'd' : 'f'}:${e.name}`);
  assert.deepEqual(names, ['d:Assets', 'd:src', ...(linked ? ['d:zz-link'] : []), 'f:file2.php', 'f:file10.php', 'f:README.md']);
  assert.equal(await isDirectory(lib), true);
  assert.equal(await isDirectory(path.join(lib, 'README.md')), false);
  assert.equal(await isDirectory(path.join(tmp, 'missing')), false);
});
