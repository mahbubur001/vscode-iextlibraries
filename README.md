# iExternal libraries

PhpStorm-style **External Libraries** for VS Code. Link a folder or file that lives outside your project — WordPress
core, a shared plugin, an SDK, PHP stubs — into the workspace, so search, code completion and "Go to Definition" see it
without copying it into the project.

The library is added as a symbolic link named `_ext_<name>` in the workspace folder; the original stays where it is.

## Usage

1. Open the Command Palette (`Cmd+Shift+P` on macOS, `Ctrl+Shift+P` on Windows and Linux).
2. Run **iExternal Libraries: Add External Library…**.
3. Choose **Folder…**, **File…** or **Enter a path…** (absolute, `~/…`, or relative to the workspace folder).
4. Confirm or change the name. The link `_ext_<name>` appears in the Explorer.

In a multi-root workspace you are asked which folder to add it to. To remove a library, delete its `_ext_` entry in the
Explorer — only the link is removed, never the original files.

## Notes

- **Windows:** folders are linked as *junctions*, which need no administrator rights. Linking a single **file** needs
  [Developer Mode](https://learn.microsoft.com/windows/apps/get-started/enable-your-device-for-development) or VS Code
  running as administrator.
- **Version control:** links are regular entries in your project. To keep them out of git, add `_ext_*` to `.gitignore`.
- **Deployment:** exclude `_ext_*` from upload in your deployment tool (for example *Exclude items by name* in
  [iRemote](https://marketplace.visualstudio.com/items?itemName=itemcoder.iremote)).
- Language servers follow the link like any other folder. Some (for example Intelephense) can instead be pointed at an
  outside folder via their own include-path setting.

## Development

```bash
npm install
npm test          # type-check (JSDoc + checkJs) and unit tests
npm run lint
npm run package   # iextlibraries-<version>.vsix
```

Press `F5` to try the extension in a new VS Code window.
