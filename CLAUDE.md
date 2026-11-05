# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

iExternal libraries (`itemcoder.iextlibraries`) reproduces PhpStorm's **External Libraries** / PHP **Include Path** in
VS Code: folders outside the project are stored as include paths, shown in an *External Libraries* view in the Explorer,
and mirrored into Intelephense for code intelligence. Nothing is written into the project tree. Sister extension of
iRemote (`itemcoder.iremote`, github.com/mahbubur001/iremote) with the same tooling, release flow and visual style;
behaviour and naming should follow PhpStorm.

## Commands

```bash
npm install
npm test           # tsc type-check of the JS (JSDoc + checkJs via jsconfig.json, strict) + unit tests
npm run lint       # eslint flat config (eslint.config.mjs)
npm run test:e2e   # downloads VS Code, runs test/e2e/suite.js inside it (opens a window; CI uses xvfb-run)
npm run package    # iextlibraries-<version>.vsix
node --test test/unit/core.test.js                                   # one unit test file
node --test --test-name-pattern="mergeManaged" "test/unit/**/*.test.js"
```

Keep `node --test` arguments as quoted globs or files, not directories (Node 22 in CI does not accept directories).

## Architecture

Plain CommonJS JavaScript, no build step, no runtime dependencies; `main` is `src/extension.js`, activated
`onStartupFinished` (so the Intelephense sync runs even when the view is collapsed).

- `src/core.js` — pure logic, **no `vscode` import** (unit-tested in Node): `~` expansion/contraction (paths in the home
  folder are stored as `~/…`, like PhpStorm's `$USER_HOME$`), user input resolution, `.idea/php.xml` include-path
  parsing (`$USER_HOME$`, `$PROJECT_DIR$`), `mergeManaged` for other tools' settings, directory listing (folders first,
  natural order, symlinks followed).
- `src/libraries.js` — `LibraryStore`: the list lives in the workspace setting `iextlibraries.includePaths`
  (ConfigurationTarget.Workspace); fires `onDidChange` on config changes. `syncIntelephense()` writes
  `intelephense.environment.includePaths` (workspace) only when Intelephense is installed and
  `iextlibraries.intelephense.sync` is on; the entries it added are remembered in workspaceState so user entries are
  never removed.
- `src/tree.js` — `LibraryTree` (TreeDataProvider for view `iextlibraries.libraries` in the Explorer). Roots are
  libraries (`contextValue` `library`, `missing` flagged), children are directory entries using `resourceUri` so the
  file-icon theme applies. Recursive FileSystemWatchers on each library refresh the view (debounced).
- `src/extension.js` — commands (`iextlibraries.add`, `.importPhpStorm`, `.remove`, `.refresh`, `.configure`,
  `.revealInOS`, `.copyPath`), the `iextlibraries.hasPhpStormProject` context key for the welcome view, and returns
  `{ store, tree }` from `activate` for the e2e tests.

Menus, welcome views and settings are declared in `package.json` `contributes`. Quick-pick items must not use a `kind`
property (reserved by VS Code for separators) — the code uses `pick`.

## Tests

Unit tests cover `src/core.js`. The e2e suite (`test/e2e/run.js` builds a temp workspace with `.idea/php.xml`)
replaces `vscode.window` dialog functions with scripted answers and drives the real commands and the tree provider.

## Release

CI (`.github/workflows/ci.yml`): type-check, lint, unit tests and packaging on Linux, Windows and macOS, plus e2e on
Linux. Pushing a `v<version>` tag matching `package.json` runs `.github/workflows/release.yml`: Marketplace via Trusted
Publishing (`vsce publish --oidc`, policy on the ItemCoder publisher for this repo and `release.yml`), Open VSX when the
`OVSX_PAT` secret is set, and a GitHub Release. Update `CHANGELOG.md` with every version.

`media/icon.svg` is the extension icon source (`media/icon.png` rendered at 256 px); `media/view.svg` is the
monochrome view icon. `docs/images/` holds README screenshots (not packaged; vsce rewrites the links to GitHub).
