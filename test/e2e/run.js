// Launches a downloaded VS Code with this extension and a temporary workspace, then runs ./suite.js inside it.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { runTests } = require('@vscode/test-electron');

const main = async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iext-e2e-'));
  const workspace = path.join(tmp, 'project');
  const wordpress = path.join(tmp, 'wordpress');
  const sdk = path.join(tmp, 'sdk');
  fs.mkdirSync(path.join(workspace, '.idea'), { recursive: true });
  fs.mkdirSync(path.join(wordpress, 'wp-includes'), { recursive: true });
  fs.writeFileSync(path.join(wordpress, 'wp-includes', 'functions.php'), '<?php function wp_die() {}');
  fs.writeFileSync(path.join(wordpress, 'index.php'), '<?php');
  fs.mkdirSync(sdk);
  // A PhpStorm project with one include path, relative to the project via $PROJECT_DIR$.
  fs.writeFileSync(
    path.join(workspace, '.idea', 'php.xml'),
    '<project version="4"><component name="PhpIncludePathManager"><include_path><path value="$PROJECT_DIR$/../wordpress" /></include_path></component></project>',
  );

  await runTests({
    extensionDevelopmentPath: path.resolve(__dirname, '../..'),
    extensionTestsPath: path.resolve(__dirname, 'suite.js'),
    launchArgs: [workspace, '--disable-extensions', '--disable-workspace-trust'],
    extensionTestsEnv: { IEXT_E2E_WORDPRESS: wordpress, IEXT_E2E_SDK: sdk },
  });
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
