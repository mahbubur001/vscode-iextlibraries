// Launches a downloaded VS Code with this extension and a temporary workspace, then runs ./suite.js inside it.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

const main = async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iext-e2e-'));
  const workspace = path.join(tmp, 'project');
  const library = path.join(tmp, 'shared-lib');
  fs.mkdirSync(workspace);
  fs.mkdirSync(path.join(library, 'src'), { recursive: true });
  fs.writeFileSync(path.join(library, 'src', 'helpers.php'), '<?php function shared_helper() {}');

  await runTests({
    extensionDevelopmentPath: path.resolve(__dirname, '../..'),
    extensionTestsPath: path.resolve(__dirname, 'suite.js'),
    launchArgs: [workspace, '--disable-extensions', '--disable-workspace-trust'],
    extensionTestsEnv: { IEXT_E2E_LIBRARY: library },
  });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
