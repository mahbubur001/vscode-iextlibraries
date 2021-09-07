// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require("vscode");
var fs = require("fs");

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log(
		'Congratulations, your extension "external-libraries" is now active!'
	);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand(
		"iExt.addLibrary",
		function () {
			// The code you place here will be executed every time your command is executed
			var options = {
				prompt: "External library, directory or file path",
			};
			vscode.window.showInputBox(options).then((input) => {
				if (input != "" && input != undefined) {
					fs.stat(input, (err, stat) => {
						if (stat && (stat.isFile() || stat.isDirectory())) {
							vscode.window.showInputBox({ prompt: "Name" }).then((name) => {
								const getLastItem = (thePath) =>
									thePath.substring(thePath.lastIndexOf("/") + 1);
								name = name || getLastItem(input);
								fs.symlink(
									input,
									vscode.workspace.rootPath + "/_ext_" + name,
									() => {
										vscode.window.showInformationMessage(
											"symlink created in " +
												vscode.workspace.rootPath +
												"/" +
												name
										);
									}
								);
							});
						} else {
							vscode.window.showErrorMessage(
								"You must provide a valid file or directory path"
							);
						}
					});
				} else {
					vscode.window.showErrorMessage(
						"You must provide a valid file or directory path"
					);
				}
			});
		}
	);

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
