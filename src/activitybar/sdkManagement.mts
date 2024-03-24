import {
  Uri,
  type Webview,
  window,
  type WebviewView,
  type WebviewViewProvider,
} from "vscode";
import { EXTENSION_NAME } from "../constants.mjs";

interface WebviewMessage {
  command: string;
  data: string;
}

export default class PackagesWebviewProvider implements WebviewViewProvider {
  public static readonly viewType = `${EXTENSION_NAME}-sdk-management`;

  private _view?: WebviewView;
  private _isDisabled = true;

  constructor(private readonly _extensionUri: Uri) {}

  public async disable(): Promise<void> {
    this._isDisabled = true;
    // TODO: switch to messages so we didn't need to reload the hole webview
    if (this._view) {
      await this._refreshHTML(this._view);
    }
  }

  public async enable(): Promise<void> {
    this._isDisabled = false;
    // TODO: switch to messages so we didn't need to reload the hole webview
    if (this._view) {
      await this._refreshHTML(this._view);
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async _getInstalledSDKs(): Promise<string[]> {
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async installSDK(sdk: string): Promise<void> {
    void window.showInformationMessage(
      "[Flipper App Dev] SDK installed successfully."
    );
    // send message installed successfully to webview for packages list
    if (this._view) {
      void this._view.webview.postMessage({
        command: "sdkInstalled",
        data: sdk,
      } as WebviewMessage);
    }
  }

  public async resolveWebviewView(webviewView: WebviewView): Promise<void> {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      switch (message.command) {
        case "installSDK":
          await this.installSDK(message.data);
          break;
        default:
          break;
      }
    });
    await this._refreshHTML(webviewView);
  }

  private async _refreshHTML(webviewView: WebviewView): Promise<void> {
    webviewView.webview.html = await this._getHtmlForWebview(
      webviewView.webview
    );
  }

  private async _getHtmlForWebview(webview: Webview): Promise<string> {
    const mainScriptUri = webview.asWebviewUri(
      Uri.joinPath(this._extensionUri, "web", "activitybar", "main.js")
    );

    const mainStyleUri = webview.asWebviewUri(
      Uri.joinPath(this._extensionUri, "web", "activitybar", "main.css")
    );

    const installedSDKs = await this._getInstalledSDKs();
    /* clean up the sdk names */
    installedSDKs.forEach((pkg, i) => {
      installedSDKs[i] = pkg.replace(".mpy", "").replace(".py", "");
    });

    // Restrict the webview to only load specific scripts
    const nonce = getNonce();

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Installed SDKs</title>

        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
          webview.cspSource
        } 'unsafe-inline'; img-src ${
      webview.cspSource
    } https:; script-src 'nonce-${nonce}';">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <link href="${mainStyleUri.toString()}" rel="stylesheet"></style>
      </head>
      <body>
        <div style="width: 100%;" class="input-div">
          ${
            this._isDisabled
              ? "<p>Your board must be connected to Wifi for this feature to work</p>"
              : `
          <input type="text" id="packageInput" placeholder="mip package" style=""/>
          <button id="installButton"><strong>Install</strong></button>`
          }
          
        </div>
        <div style="width: 100%;">
          <p><strong>Installed packages:</strong></p>
          <ul id="installedSDKsList" ${this._isDisabled ? "disabled" : ""}>
          ${installedSDKs.map(p => `<li>${p}</li>`).join("")}
          </ul>
        </div>

        <script nonce="${nonce}" src="${mainScriptUri.toString()}"></script>
      </body>
      </html>
    `;
  }
}

function getNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return text;
}
