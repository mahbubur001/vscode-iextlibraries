const vscode = require('vscode');
const { PREFIX, resolveSource, defaultName, validateName, linkPath, exists, createLink, describeError } = require('./links');

/** Workspace folder to link into; asks when there are several. */
const pickWorkspaceFolder = async () => {
  const folders = (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === 'file');
  if (folders.length === 0) {
    void vscode.window.showErrorMessage('Open a folder first: external libraries are linked into a workspace folder.');
    return undefined;
  }
  return folders.length === 1 ? folders[0] : vscode.window.showWorkspaceFolderPick({ placeHolder: 'Add the external library to which folder?' });
};

/**
 * Asks for the external file or folder. Native dialogs cannot pick files and folders at once on Windows and Linux,
 * so the type is chosen first; typing a path is kept for pasting.
 * @param {vscode.WorkspaceFolder} folder
 * @returns {Promise<string | undefined>}
 */
const pickSource = async (folder) => {
  const choice = await vscode.window.showQuickPick(
    [
      { label: '$(folder) Folder…', pick: 'folder' },
      { label: '$(file) File…', pick: 'file' },
      { label: '$(edit) Enter a path…', pick: 'path' },
    ],
    { placeHolder: 'Add an external folder or file to the project' },
  );
  if (!choice) return undefined;
  if (choice.pick === 'path') {
    const input = await vscode.window.showInputBox({
      prompt: 'Path of the external folder or file (absolute, ~/…, or relative to the workspace folder)',
      placeHolder: '/path/to/library',
      ignoreFocusOut: true,
      validateInput: async (value) => {
        if (!value.trim()) return undefined;
        return (await exists(resolveSource(value, folder.uri.fsPath))) ? undefined : 'No file or folder at this path.';
      },
    });
    return input?.trim() ? resolveSource(input, folder.uri.fsPath) : undefined;
  }
  const uris = await vscode.window.showOpenDialog({
    canSelectFiles: choice.pick === 'file',
    canSelectFolders: choice.pick === 'folder',
    canSelectMany: false,
    openLabel: 'Add as External Library',
  });
  return uris?.[0]?.fsPath;
};

const addLibrary = async () => {
  const folder = await pickWorkspaceFolder();
  if (!folder) return;
  const source = await pickSource(folder);
  if (!source) return;

  const name = await vscode.window.showInputBox({
    prompt: `Name of the link in "${folder.name}" (created as ${PREFIX}<name>)`,
    value: defaultName(source),
    ignoreFocusOut: true,
    validateInput: async (value) =>
      validateName(value) ?? ((await exists(linkPath(folder.uri.fsPath, value))) ? `${PREFIX}${value} already exists in "${folder.name}".` : undefined),
  });
  if (name === undefined) return;

  const link = linkPath(folder.uri.fsPath, name);
  try {
    await createLink(source, link);
  } catch (error) {
    void vscode.window.showErrorMessage(`Could not add the external library: ${describeError(error, link)}`);
    return;
  }
  const reveal = await vscode.window.showInformationMessage(`Linked ${source} as ${PREFIX}${name} in "${folder.name}".`, 'Reveal in Explorer');
  if (reveal) await vscode.commands.executeCommand('revealInExplorer', vscode.Uri.file(link));
};

/** @param {vscode.ExtensionContext} context */
function activate(context) {
  context.subscriptions.push(vscode.commands.registerCommand('iExt.addLibrary', addLibrary));
}

function deactivate() {}

module.exports = { activate, deactivate };
