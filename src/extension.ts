import * as vscode from "vscode";
import * as path from "path";

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "icon-symbol-preview.pickIconSymbolTemplateFile",
    async () => {
      const rootPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
      if (!rootPath) {
        vscode.window.showErrorMessage("No workspace is opened.");
        return;
      }

      const files = await vscode.workspace.findFiles(
        "**/*",
        "**/{node_modules,.git}/**"
      );
      const items = files.map((file) => {
        return { label: path.relative(rootPath, file.fsPath) };
      });
      const options: vscode.QuickPickOptions = {
        canPickMany: false,
        placeHolder: "Select a file",
      };

      const file = await vscode.window.showQuickPick(items, options);
      if (!file) {
        vscode.window.showInformationMessage("Not Select Icon Symbol File");
        return;
      }

      const filePath = path.join(rootPath, file.label);
      const document = await vscode.workspace.openTextDocument(filePath);
      const symbols = document
        .getText()
        .match(/<symbol [^>]*>(.*?)<\/symbol>/g) as string[];
      if (!symbols || symbols.length === 0) {
        vscode.window.showInformationMessage(
          "Select File doesn't have Icon Symbol"
        );
        return;
      }

      const panel = vscode.window.createWebviewPanel(
        "iconSymbolPreview",
        `Icon Preview - ${file.label}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
        }
      );

      const styleUri = panel.webview.asWebviewUri(
        vscode.Uri.joinPath(context.extensionUri, "styles", "index.css")
      );
      panel.webview.html = getWebviewContent(symbols, styleUri);

      panel.webview.onDidReceiveMessage((message) => {
        if (message.command === "copyToClipboard") {
          vscode.env.clipboard.writeText(message.text);
          vscode.window.showInformationMessage(
            `Symbol ID: '${message.text}' has been copied to Clipboard!`
          );
        }
      });
    }
  );

  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}

function icon(symbol: string) {
  const id = symbol.match(/<symbol\s[^>]*id="([^"]+)"/)?.[1];
  return `
    <div class="icon-item" title="${id}" data-id="${id}">
        <svg>
            <use xlink:href='#${id}'></use>
        </svg>
        <p>${id}</p>
    </div> 
      `;
}

function getWebviewContent(symbols: string[], styleUri: vscode.Uri) {
  const icons = symbols.map(icon).join("");

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Icon Symbol</title>
        <link rel="stylesheet" type="text/css" href="${styleUri}">
    </head>
    <body>
      <svg aria-hidden="true" style="position: absolute; width: 0px; height: 0px; overflow: hidden; fill:currentColor">
          ${symbols.join("")}
      </svg>
      <div class="container">
          ${icons}
      </div>
      <script>
          const vscode = acquireVsCodeApi();
          document.querySelectorAll('.icon-item').forEach(el=>el.addEventListener('click', (e) => {
              vscode.postMessage({
                  command: 'copyToClipboard',
                  text: el.getAttribute('data-id')
              });
          }));
      </script>
    </body>
  </html>`;
}
