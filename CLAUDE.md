# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

iExternal libraries (`itemcoder.iextlibraries`) is a small VS Code extension that mirrors PhpStorm's **External
Libraries**: it links a folder or file from outside the project into a workspace folder as a symbolic link named
`_ext_<name>`, so search, completion and language servers see it. Sister extension of iRemote
(`itemcoder.iremote`, github.com/mahbubur001/iremote), with the same tooling, release flow and visual style.

## Commands

```bash
npm install
npm test           # tsc type-check of the JS (JSDoc + checkJs, jsconfig.json) + unit tests
npm run lint       # eslint flat config (eslint.config.mjs)
npm run test:e2e   # downloads VS Code, runs test/e2e/suite.js inside it (opens a window; CI uses xvfb-run)
npm run package    # iextlibraries-<version>.vsix
node --test test/unit/links.test.js                       # one unit test file
node --test --test-name-pattern="defaultName" "test/unit/**/*.test.js"
```

Keep `node --test` arguments as quoted globs or files, not directories (Node 22 in CI does not accept directories).

## Code

Plain CommonJS JavaScript, no build step and no runtime dependencies; `main` is `src/extension.js`. Types come from
JSDoc and are enforced by `npm run typecheck` (strict).

- `src/links.js` — everything that touches the file system (path resolution, default names, validation, link creation,
  error messages). Must not import `vscode`, so it is unit-tested in plain Node.
- `src/extension.js` — the `iExt.addLibrary` command: workspace-folder pick, Folder / File / Enter-a-path source pick,
  name prompt with validation, success message with Reveal in Explorer.

Compatibility: keep the command id `iExt.addLibrary` and the `_ext_` prefix (users of 0.0.x have links and keybindings
using them). On Windows, folders are linked as junctions (no admin rights); file symlinks need Developer Mode/admin.
Quick-pick items must not use a `kind` property (reserved by VS Code for separators) — the code uses `pick`.

The e2e suite replaces `vscode.window` dialog functions with scripted answers and runs the real command.

## Release

CI (`.github/workflows/ci.yml`): type-check, lint, unit tests and packaging on Linux, Windows and macOS, plus the e2e
job on Linux. Pushing a `v<version>` tag that matches `package.json` runs `.github/workflows/release.yml`: Marketplace
via Trusted Publishing (`vsce publish --oidc`; the ItemCoder publisher needs a policy for this repository and
`release.yml`), Open VSX when the `OVSX_PAT` secret is set, and a GitHub Release with the `.vsix`. Update
`CHANGELOG.md` with every version.

`media/icon.svg` is the icon source; `media/icon.png` is rendered from it at 256 px.
