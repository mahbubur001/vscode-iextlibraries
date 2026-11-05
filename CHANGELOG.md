# Changelog

## 0.1.0

- Pick the library with a **Folder…** / **File…** dialog or type a path (`~` and paths relative to the workspace folder
  are resolved, surrounding quotes are removed).
- Multi-root workspaces: choose the folder to add the library to. Without an open folder, a clear message is shown.
- Fix: a failed link (name already taken, missing permission) was reported as success.
- Fix: the success message showed the wrong path (without the `_ext_` prefix).
- Fix: the default name was wrong for Windows paths and paths ending in a separator.
- Fix: pressing Escape at the name prompt still created the link.
- Names containing path characters (`/`, `\`, `..`) are rejected, so links cannot be created outside the project.
- Windows: folders are linked as junctions — no administrator rights needed anymore.
- **Reveal in Explorer** after adding a library.
- Requires VS Code 1.90 or newer. New icon. No runtime dependencies.

## 0.0.2

- Initial release: add an external file or folder to the project as a symlink.
