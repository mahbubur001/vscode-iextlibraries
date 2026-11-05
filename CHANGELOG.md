# Changelog

## 1.0.0

Rebuilt after PhpStorm's External Libraries.

- **External Libraries view** in the Explorer: one entry per library, browsable like a folder, with file icons,
  *Reveal in File Manager*, *Copy Path* and *Remove*. Missing folders are flagged as *not found*. The view refreshes when
  files are added or removed in a library.
- Libraries are **include paths** stored in the workspace setting `iextlibraries.includePaths` — nothing is created
  inside the project, so git and deployment are unaffected. Home-folder paths are saved as `~/…`.
- **Intelephense integration**: libraries are mirrored into `intelephense.environment.includePaths`
  (`iextlibraries.intelephense.sync`), keeping the entries you added yourself.
- **Import from PhpStorm**: reads `<include_path>` from `.idea/php.xml` (`$USER_HOME$` and `$PROJECT_DIR$` expanded).
- Add several folders at once, or type a path (`~/…`, absolute, or relative to the workspace).
- **Breaking:** the symlink approach of 0.x (`_ext_` links and the `iExt.addLibrary` command) is removed. Delete old
  `_ext_*` links from your projects and add the folders again as external libraries.

## 0.1.0

- Folder / File / path pick, multi-root support, error handling and Windows junctions for the symlink-based version.

## 0.0.2

- Initial release: add an external file or folder to the project as a symlink.
