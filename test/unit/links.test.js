const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PREFIX, resolveSource, defaultName, validateName, linkPath, exists, createLink, describeError } = require('../../src/links');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iext-'));

test('resolveSource expands ~, strips quotes and resolves relative paths', () => {
  const base = path.join(tmp, 'project');
  assert.equal(resolveSource('~', base), os.homedir());
  assert.equal(resolveSource('~/libs/wp', base), path.join(os.homedir(), 'libs', 'wp'));
  assert.equal(resolveSource('  "../shared lib"  ', base), path.join(tmp, 'shared lib'));
  assert.equal(resolveSource("'vendor'", base), path.join(base, 'vendor'));
  const absolute = path.join(tmp, 'abs');
  assert.equal(resolveSource(absolute, base), absolute);
});

test('defaultName takes the last segment for either separator and ignores trailing separators', () => {
  assert.equal(defaultName('/srv/www/wordpress/'), 'wordpress');
  assert.equal(defaultName('C:\\libs\\woocommerce\\'), 'woocommerce');
  assert.equal(defaultName('/srv/functions.php'), 'functions.php');
});

test('validateName rejects empty names, dot names and path characters', () => {
  assert.equal(validateName('wordpress'), undefined);
  assert.equal(validateName('wp core 6.6'), undefined);
  for (const bad of ['', '  ', '.', '..', '../x', 'a/b', 'a\\b', 'c:x']) assert.ok(validateName(bad), `"${bad}" should be rejected`);
});

test('linkPath adds the _ext_ prefix inside the workspace folder', () => {
  assert.equal(linkPath(path.join(tmp, 'project'), 'wordpress'), path.join(tmp, 'project', `${PREFIX}wordpress`));
});

test('createLink links folders and files and refuses to overwrite', async () => {
  const lib = path.join(tmp, 'lib');
  fs.mkdirSync(path.join(lib, 'src'), { recursive: true });
  fs.writeFileSync(path.join(lib, 'src', 'a.php'), '<?php');
  const project = path.join(tmp, 'p1');
  fs.mkdirSync(project);

  const dirLink = linkPath(project, 'lib');
  assert.deepEqual(await createLink(lib, dirLink), { isDirectory: true });
  assert.ok(fs.lstatSync(dirLink).isSymbolicLink());
  assert.equal(fs.readFileSync(path.join(dirLink, 'src', 'a.php'), 'utf8'), '<?php');
  await assert.rejects(createLink(lib, dirLink), (e) => /** @type {NodeJS.ErrnoException} */ (e).code === 'EEXIST');

  const fileLink = linkPath(project, 'a.php');
  try {
    assert.deepEqual(await createLink(path.join(lib, 'src', 'a.php'), fileLink), { isDirectory: false });
    assert.ok(fs.lstatSync(fileLink).isSymbolicLink());
  } catch (e) {
    // File symlinks need Developer Mode or admin rights on Windows; the folder case above is what matters there.
    if (!(process.platform === 'win32' && /** @type {NodeJS.ErrnoException} */ (e).code === 'EPERM')) throw e;
  }
});

test('createLink fails for a missing source and exists() sees broken links', async () => {
  const project = path.join(tmp, 'p2');
  fs.mkdirSync(project);
  await assert.rejects(createLink(path.join(tmp, 'missing'), linkPath(project, 'missing')), (e) => /** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT');
  assert.equal(await exists(linkPath(project, 'missing')), false);
});

test('describeError explains common failures', () => {
  /** @param {string} code */
  const err = (code) => Object.assign(new Error(code), { code });
  assert.match(describeError(err('EEXIST'), '/p/_ext_wp'), /_ext_wp already exists/);
  assert.match(describeError(err('EPERM'), '/p/_ext_wp', 'win32'), /Developer Mode/);
  assert.match(describeError(err('EACCES'), '/p/_ext_wp', 'linux'), /No permission/);
  assert.equal(describeError(new Error('boom'), '/p/x'), 'boom');
});
