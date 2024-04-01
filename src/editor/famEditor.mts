/* eslint-disable max-len */
import { Uri, workspace, commands, window, EventEmitter } from "vscode";
import type {
  CustomDocument,
  CustomEditorProvider,
  ExtensionContext,
  CancellationToken,
  CustomDocumentOpenContext,
  WebviewPanel,
  CustomDocumentEditEvent,
  CustomDocumentBackup,
  Webview,
  Disposable,
  CustomDocumentBackupContext,
} from "vscode";
import { WebviewCollection } from "./webviewCollection.mjs";
import { DisposableBase, disposeAll } from "./dispose.mjs";
import { EXTENSION_NAME } from "../constants.mjs";

interface FamDocumentEdit {
  readonly property: string;
  readonly value: string;
}

interface FamDocumentDelegate {
  getFileData(): Promise<Uint8Array>;
}

interface WebviewMessage extends FamDocumentEdit {
  readonly type: string;
  readonly requestId: number;
  readonly body: string;
}

interface FamDocumentProperties {
  appid: string;
  name: string;
  apptype: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  entry_point: string;
  cdefines?: string[];
  cincludes?: string[];
  cflags?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  stack_size?: number;
  order?: number;
  requires?: string[];
  conflicts?: string[];
  icon?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  sdk_headers?: string[];
  targets?: string[];
  resources?: string;
  sources?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_version?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_icon?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_libs?: string[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_category: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_description?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_author: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_weburl?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_icon_assets?: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_extbuild?: FamExtFile[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fal_embedded?: boolean;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_private_libs?: FamLib[];
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_include_paths?: string[];
}

interface FamLib {
  name: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  fap_include_paths?: string[];
  sources?: string[];
  cdefines?: string[];
  cflags?: string[];
  cincludes?: string[];
}

interface FamExtFile {
  path: string;
  command: string;
}

interface FamAppData {
  [key: string]:
    | string
    | number
    | string[]
    | boolean
    | FamExtFile[]
    | FamLib[]
    | undefined;
}

function extractFapPrivateLibs(input: string): [FamLib[], string] | undefined {
  const startIndex = input.indexOf("fap_private_libs=[");
  const startIndex2 = input.indexOf("fap_private_libs = [");
  const startIndex3 = input.indexOf("fap_private_libs =[");
  const startIndex4 = input.indexOf("fap_private_libs= [");
  const index = Math.max(startIndex, startIndex2, startIndex3, startIndex4);
  if (index === -1) {
    return;
  }

  let remainingInput = input;
  if (index === -1) {
    return [[], remainingInput];
  }

  let bracketCount = 0;
  let endIndex = index;
  for (let i = index; i < input.length; i++) {
    if (input[i] === "[") {
      bracketCount++;
    } else if (input[i] === "]") {
      bracketCount--;
      if (bracketCount === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex === index) {
    return [[], remainingInput];
  }

  const subString = remainingInput.slice(index, endIndex + 1);
  const libStrings = subString.match(/Lib\(([^)]+)\)/g);

  if (!libStrings) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/naming-convention
  const fap_private_libs: FamLib[] = libStrings.map((libString: string) => {
    const nameMatch = libString.match(/name="([^"]+)"/);
    if (!nameMatch) {
      return { name: "" };
    }

    const name = nameMatch[1];
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const fap_include_pathsMatch = libString.match(
      /fap_include_paths=\[(.*?)\]/
    );
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const fap_include_paths = fap_include_pathsMatch
      ? fap_include_pathsMatch[1]
          .split(",")
          .map(s => s.trim().replace(/"/g, ""))
          .filter(s => s.length > 1)
      : undefined;

    const sourcesMatch = libString.match(
      /sources\s*=\s*\[\s*((?:\s*"[^"]+",?\s*)+)\]/
    );
    const sources = sourcesMatch
      ? sourcesMatch[1]
          .split(",")
          .map(s => s.trim().replace(/"/g, ""))
          .filter(s => s.length > 1)
      : undefined;

    const cdefinesMatch = libString.match(/cdefines=\[(.*?)\]/);
    const cdefines = cdefinesMatch
      ? cdefinesMatch[1]
          .split(",")
          .map(s => s.trim().replace(/"/g, ""))
          .filter(s => s.length > 1)
      : undefined;

    const cflagsMatch = libString.match(/cflags=\[(.*?)\]/);
    const cflags = cflagsMatch
      ? cflagsMatch[1]
          .split(",")
          .map(s => s.trim().replace(/"/g, ""))
          .filter(s => s.length > 1)
      : undefined;

    const cIncludesMatch = libString.match(/cincludes\s*=\s*\[(.*?)\]/);
    const cincludes = cIncludesMatch
      ? cIncludesMatch[1]
          .split(",")
          .map(s => s.trim().replace(/"/g, ""))
          .filter(s => s.length > 1)
      : undefined;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    return { name, fap_include_paths, sources, cdefines, cflags, cincludes };
  });

  // Remove the extracted portion from the remainingInput
  remainingInput =
    remainingInput.slice(0, index) + remainingInput.slice(endIndex + 3);

  return [fap_private_libs, remainingInput];
}

function extractProperties(content: string): FamAppData {
  const appData: FamAppData = {};

  const result = extractFapPrivateLibs(content);
  if (result) {
    appData.fap_private_libs = result[0];
    content = result[1];
  }

  // v1 const regex = /(\w+)\s*=\s*(?:"([^"]*)"|([^",\n]+))/g;
  // v2 const regex = /(\w+)\s*=\s*(?:"([^"]*)"|(?:(\[)([\s\S]*?)\])|([^",\n]+))/g;
  const regex =
    /(\w+)\s*=\s*(?:"([^"]*)"|(\()\s*(\s*ExtFile\s*\(\s*(?:[\s\S]*?)\))*\s*\)|(?:(\[)([\s\S]*?)\])|([^",\n]+))/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const [
      ,
      key,
      stringValue,
      tupleIndicator,
      extFiles,
      arrayIndicator,
      arrayValue,
      nonStringValue,
    ] = match;
    const isArray = arrayIndicator !== undefined;
    const isTuple = tupleIndicator !== undefined;
    const value = stringValue || extFiles || arrayValue || nonStringValue;
    // check if value is in format "number * 1024" with regex
    if (key === "stack_size" && value.match(/^\d+\s*\*\s*1024$/)) {
      const [number] = value.match(/\d+/) as RegExpMatchArray;
      appData[key] = parseInt(number, 10);
    } else if (
      key === "apptype" &&
      value.match(
        /^FlipperAppType\.(SERVICE|SYSTEM|APP|PLUGIN|DEBUG|ARCHIVE|SETTINGS|STARTUP|EXTERNAL|METAPACKAGE)$/
      )
    ) {
      appData[key] = value.split(".")[1];
    } else if (isArray) {
      appData[key] = value
        .split(",")
        .map(item => item.trim().replace(/"/g, ""))
        .filter(s => s.length > 1);
    } else if (isTuple && extFiles) {
      // split a string containing multiple ExtFile(path="", command="") into an array of FamExtFile objects
      const extFileArray = extFiles.split("ExtFile");
      const pathCommandRegex =
        /(path|command)="([^"]+)"[,\s]*(path|command)="([^"]+)"/g;
      appData[key] = [];

      for (const extFile of extFileArray) {
        const match = pathCommandRegex.exec(extFile);
        if (match) {
          const [, pathCommandKey1, pathValue, pathCommandKey2, commandValue] =
            match;
          (appData[key] as FamExtFile[]).push({
            path: pathCommandKey1 === "path" ? pathValue : commandValue,
            command: pathCommandKey2 === "command" ? commandValue : pathValue,
          });
        }
      }
    } else {
      appData[key] = isNaN(Number(value))
        ? value === "True"
          ? true
          : value === "False"
          ? false
          : value
        : parseFloat(value);
    }
  }

  return appData;
}

export default class FamDocument
  extends DisposableBase
  implements CustomDocument
{
  static async create(
    uri: Uri,
    backupId: string | undefined,
    delegate: FamDocumentDelegate
  ): Promise<FamDocument | PromiseLike<FamDocument>> {
    const dataFile = typeof backupId === "string" ? Uri.parse(backupId) : uri;
    const fileData = await FamDocument.readFile(dataFile);

    return new FamDocument(uri, fileData, delegate);
  }

  private static async readFile(uri: Uri): Promise<Uint8Array> {
    if (uri.scheme === "untitled") {
      return new Uint8Array();
    }

    return new Uint8Array(await workspace.fs.readFile(uri));
  }

  private readonly _uri: Uri;
  private _documentData: Uint8Array;
  private readonly _properties: FamDocumentProperties;
  private _edits: FamDocumentEdit[] = [];
  private _savedEdits: FamDocumentEdit[] = [];

  private readonly _delegate: FamDocumentDelegate;

  private constructor(
    uri: Uri,
    initialContent: Uint8Array,
    delegate: FamDocumentDelegate
  ) {
    super();
    this._uri = uri;
    this._documentData = initialContent;
    this._delegate = delegate;

    const contentString = Buffer.from(initialContent).toString("utf-8");
    const appData = extractProperties(contentString);
    this._properties = this.validateProperties(appData);
  }

  private validateProperties(data: FamAppData): FamDocumentProperties {
    const properties: FamDocumentProperties = {
      appid: data.appid as string,
      name: data.name as string,
      apptype: data.apptype as string,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      entry_point: data.entry_point as string,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      fap_category: data.fap_category as string,
      // eslint-disable-next-line @typescript-eslint/naming-convention
      fap_author: data.fap_author as string,
    };

    if (data.fap_icon !== undefined) {
      properties.fap_icon = data.fap_icon as string;
    }

    if (data.stack_size !== undefined && !isNaN(Number(data.stack_size))) {
      properties.stack_size = data.stack_size as number;
    }

    if (data.order !== undefined && !isNaN(Number(data.order))) {
      properties.order = data.order as number;
    }

    if (data.requires !== undefined && Array.isArray(data.requires)) {
      properties.requires = data.requires as string[];
    }

    if (data.cdefines !== undefined && Array.isArray(data.cdefines)) {
      properties.cdefines = data.cdefines as string[];
    }

    if (data.conflicts !== undefined) {
      properties.conflicts = data.conflicts as string[];
    }

    if (data.icon !== undefined) {
      properties.icon = data.icon as string;
    }

    if (data.sdk_headers !== undefined) {
      properties.sdk_headers = data.sdk_headers as string[];
    }

    if (data.targets !== undefined) {
      properties.targets = data.targets as string[];
    }

    if (data.resources !== undefined) {
      properties.resources = data.resources as string;
    }

    if (data.sources !== undefined) {
      properties.sources = data.sources as string[];
    }

    if (data.fap_version !== undefined) {
      properties.fap_version = data.fap_version as string;
    }

    if (data.fap_icon !== undefined) {
      properties.fap_icon = data.fap_icon as string;
    }

    if (data.fap_libs !== undefined) {
      properties.fap_libs = data.fap_libs as string[];
    }

    if (data.fap_description !== undefined) {
      properties.fap_description = data.fap_description as string;
    }

    if (data.fap_weburl !== undefined) {
      properties.fap_weburl = data.fap_weburl as string;
    }

    if (data.fap_icon_assets !== undefined) {
      properties.fap_icon_assets = data.fap_icon_assets as string;
    }

    if (data.fap_extbuild !== undefined) {
      properties.fap_extbuild = data.fap_extbuild as FamExtFile[];
    }

    if (data.fal_embedded !== undefined) {
      properties.fal_embedded = data.fal_embedded as boolean;
    }

    if (data.fap_private_libs !== undefined) {
      properties.fap_private_libs = data.fap_private_libs as FamLib[];
    }

    if (data.fap_include_paths !== undefined) {
      properties.fap_include_paths = data.fap_include_paths as string[];
    }

    return properties;
  }

  public get uri(): Uri {
    return this._uri;
  }

  public get documentData(): Uint8Array {
    return this._documentData;
  }

  public get properties(): FamDocumentProperties {
    return this._properties;
  }

  private readonly _onDidDispose = this._register(new EventEmitter<void>());
  public readonly onDidDispose = this._onDidDispose.event;

  public readonly _onDidChangeDocument = this._register(
    new EventEmitter<{
      readonly content?: Uint8Array;
      readonly edits: readonly FamDocumentEdit[];
    }>()
  );
  public readonly onDidChangeContent = this._onDidChangeDocument.event;

  private readonly _onDidChange = this._register(
    new EventEmitter<{
      readonly label: string;
      undo(): void;
      redo(): void;
    }>()
  );
  public readonly onDidChange = this._onDidChange.event;

  public dispose(): void {
    this._onDidDispose.fire();
    super.dispose();
  }

  public makeEdit(edit: FamDocumentEdit): void {
    this._edits.push(edit);

    this._onDidChange.fire({
      label: "Value Change",
      undo: () => {
        this._edits.pop();
        this._onDidChangeDocument.fire({
          content: this._documentData,
          edits: this._edits,
        });
      },
      redo: () => {
        this._edits.push(edit);
        this._onDidChangeDocument.fire({
          content: this._documentData,
          edits: this._edits,
        });
      },
    });
  }

  /**
   * Called by VS Code when the user saves the document.
   */
  public async save(cancellation: CancellationToken): Promise<void> {
    await this.saveAs(this.uri, cancellation);
    this._savedEdits = Array.from(this._edits);
  }

  /**
   * Called by VS Code when the user saves the document to a new location.
   */
  public async saveAs(
    targetResource: Uri,
    cancellation: CancellationToken
  ): Promise<void> {
    const fileData = await this._delegate.getFileData();
    if (cancellation.isCancellationRequested) {
      return;
    }
    await workspace.fs.writeFile(targetResource, fileData);
  }

  /**
   * Called by VS Code when the user calls `revert` on a document.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async revert(_cancellation: CancellationToken): Promise<void> {
    const diskContent = await FamDocument.readFile(this.uri);
    this._documentData = diskContent;
    this._edits = this._savedEdits;
    this._onDidChangeDocument.fire({
      content: diskContent,
      edits: this._edits,
    });
  }

  /**
   * Called by VS Code to backup the edited document.
   *
   * These backups are used to implement hot exit.
   */
  public async backup(
    destination: Uri,
    cancellation: CancellationToken
  ): Promise<CustomDocumentBackup> {
    await this.saveAs(destination, cancellation);

    return {
      id: destination.toString(),
      delete: () => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        (workspace.fs.delete(destination) as Promise<void>)
          .then(() => {
            console.debug("Current backup deleted");
          })
          .catch((error: Error | string) => {
            console.error(error);
          });
      },
    };
  }
}

export class FamEditorProvider implements CustomEditorProvider<FamDocument> {
  private static newFamFieldId = 1;
  public static readonly viewType = `${EXTENSION_NAME}.famEdit`;
  public static readonly newViewCommand = `${FamEditorProvider.viewType}.new`;
  private readonly webviews = new WebviewCollection();

  public static register(context: ExtensionContext): Disposable {
    commands.registerCommand(FamEditorProvider.newViewCommand, () => {
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders) {
        void window.showErrorMessage("No workspace folder is open.");

        return;
      }

      const uri = Uri.joinPath(
        workspaceFolders[0].uri,
        `application-${FamEditorProvider.newFamFieldId++}.fam`
      ).with({ scheme: "untitled" });

      void commands.executeCommand(
        "vscode.openWith",
        uri,
        FamEditorProvider.viewType
      );
    });

    return window.registerCustomEditorProvider(
      FamEditorProvider.viewType,
      new FamEditorProvider(context),
      {
        webviewOptions: {
          // TODO: avoid using this setting unless it's
          // absolutely required as it does have memory overhead.
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  constructor(private readonly _context: ExtensionContext) {}

  private static createFileDataFromProperties(
    props: FamDocumentProperties
  ): Uint8Array {
    let fileContent = "App(\n";

    // Serialize each property
    for (const [key, value] of Object.entries(props)) {
      switch (key) {
        case "apptype":
          fileContent += `    ${key}=FlipperAppType.${(
            value as string
          ).toUpperCase()},\n`;
          break;
        case "stack_size":
          fileContent += `    ${key}=${value} * 1024,\n`;
          break;

        default:
          {
            if (typeof value === "string") {
              fileContent += `    ${key}="${value}",\n`;
            } else if (typeof value === "number") {
              if (key === "stack_size") {
                fileContent += `    ${key}=${value} * 1024,\n`;
              } else {
                fileContent += `    ${key}=${value},\n`;
              }
            } else if (typeof value === "boolean") {
              fileContent += `    ${key}=${value ? "True" : "False"},\n`;
            } else if (Array.isArray(value) && key === "fap_extbuild") {
              const val2 = value as FamExtFile[];
              if (val2.length > 0) {
                fileContent += `    ${key}=(\n`;
                val2.forEach(val => {
                  fileContent += `        ExtFile(\n          path="${val.path}",\n          command="${val.command}"\n        ),\n`;
                });
                fileContent += "    ),\n";
              }
            } else if (Array.isArray(value) && key === "fap_private_libs") {
              const val2 = value as FamLib[];
              if (val2.length > 0) {
                fileContent += `    ${key}=[\n`;
                val2.forEach(val => {
                  fileContent += `        Lib(\n          name="${val.name}"`;
                  if (
                    val.fap_include_paths &&
                    val.fap_include_paths.length > 0
                  ) {
                    fileContent += `,\n          fap_include_paths=[\n`;
                    val.fap_include_paths?.forEach(path => {
                      fileContent += `              "${path}",\n`;
                    });
                    fileContent += "          ]";
                  }
                  if (val.sources && val.sources.length > 0) {
                    fileContent += `,\n          sources=[\n`;
                    val.sources?.forEach(source => {
                      fileContent += `              "${source}",\n`;
                    });
                    fileContent += "          ]";
                  }
                  if (val.cdefines && val.cdefines.length > 0) {
                    fileContent += `,\n          cdefines=[\n`;
                    val.cdefines?.forEach(define => {
                      fileContent += `              "${define}",\n`;
                    });
                    fileContent += "          ]";
                  }
                  if (val.cflags && val.cflags.length > 0) {
                    fileContent += `,\n          cflags=[\n`;
                    val.cflags?.forEach(flag => {
                      fileContent += `              "${flag}",\n`;
                    });
                    fileContent += "          ]";
                  }
                  if (val.cincludes && val.cincludes.length > 0) {
                    fileContent += `,\n          cincludes=[\n`;
                    val.cincludes?.forEach(include => {
                      fileContent += `            "${include}",\n`;
                    });
                    fileContent += "          ]";
                  }
                  fileContent += "\n        ),\n";
                });
                fileContent += "    ],\n";
              }
            } else if (Array.isArray(value)) {
              if (value.length > 0) {
                fileContent += `    ${key}=[\n`;
                value.forEach(val => {
                  fileContent += `        "${val}",\n`;
                });
                fileContent += "    ],\n";
              }
            }
          }
          break;
      }
    }

    fileContent += ")";

    // Convert to Uint8Array
    return new TextEncoder().encode(fileContent);
  }

  public async openCustomDocument(
    uri: Uri,
    openContext: CustomDocumentOpenContext,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _token: CancellationToken
  ): Promise<FamDocument> {
    const document: FamDocument = await FamDocument.create(
      uri,
      openContext.backupId,
      {
        getFileData: async () => {
          const webviewsForDocument = Array.from(
            this.webviews.get(document.uri)
          );
          if (!webviewsForDocument.length) {
            throw new Error("Could not find webview to save for");
          }
          const panel = webviewsForDocument[0];
          const response = (await this.postMessageWithResponse(
            panel,
            "getFileData",
            JSON.stringify({})
          )) as FamDocumentProperties;

          return new Uint8Array(
            FamEditorProvider.createFileDataFromProperties(response)
          );
        },
      }
    );

    const listeners: Disposable[] = [];

    listeners.push(
      document.onDidChange(e => {
        this._onDidChangeCustomDocument.fire({
          document,
          ...e,
        });
      })
    );

    listeners.push(
      document.onDidChangeContent(e => {
        // Update all webviews when the document changes
        for (const webviewPanel of this.webviews.get(document.uri)) {
          void this.postMessage(
            webviewPanel,
            "update",
            JSON.stringify({
              edits: e.edits,
              content: e.content,
            })
          );
        }
      })
    );

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }

  public resolveCustomEditor(
    document: FamDocument,
    webviewPanel: WebviewPanel,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    token: CancellationToken
  ): void {
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      localResourceRoots: [Uri.joinPath(this._context.extensionUri, "web")],
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(
      webviewPanel.webview,
      document.properties
    );

    webviewPanel.webview.onDidReceiveMessage((e: WebviewMessage) =>
      this.onMessage(document, e)
    );

    // Wait for the webview to be properly readoy before we init it
    webviewPanel.webview.onDidReceiveMessage((e: WebviewMessage) => {
      switch (e.type) {
        case "ready":
          {
            if (document.uri.scheme === "untitled") {
              // TODO: default application.fam maybe
              void this.postMessage(
                webviewPanel,
                "init",
                JSON.stringify({ untitled: true, editable: true })
              );
            } else {
              const editable = workspace.fs.isWritableFileSystem(
                document.uri.scheme
              );

              void this.postMessage(
                webviewPanel,
                "init",
                JSON.stringify({ value: document.properties, editable })
              );
            }
          }
          break;

        case "edit":
          {
            document.makeEdit(e as FamDocumentEdit);
          }
          break;

        default:
          break;
      }
    });
  }

  private readonly _onDidChangeCustomDocument = new EventEmitter<
    CustomDocumentEditEvent<FamDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  public saveCustomDocument(
    document: FamDocument,
    cancellation: CancellationToken
  ): Promise<void> {
    return document.save(cancellation);
  }

  public saveCustomDocumentAs(
    document: FamDocument,
    destination: Uri,
    cancellation: CancellationToken
  ): Promise<void> {
    return document.saveAs(destination, cancellation);
  }

  public revertCustomDocument(
    document: FamDocument,
    cancellation: CancellationToken
  ): Promise<void> {
    return document.revert(cancellation);
  }

  public backupCustomDocument(
    document: FamDocument,
    context: CustomDocumentBackupContext,
    cancellation: CancellationToken
  ): Promise<CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  private getHtmlForWebview(
    webview: Webview,
    props: FamDocumentProperties
  ): string {
    const mainScriptUri = webview.asWebviewUri(
      Uri.joinPath(this._context.extensionUri, "web", "assets", "main.js")
    );
    const mainStyleUri = webview.asWebviewUri(
      Uri.joinPath(this._context.extensionUri, "web", "assets", "main.css")
    );
    const milligramStyleUri = webview.asWebviewUri(
      Uri.joinPath(
        this._context.extensionUri,
        "web",
        "assets",
        "milligram-1.4.1",
        "dist",
        "milligram.min.css"
      )
    );

    const nonce = getNonce();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${
      webview.cspSource
    } 'unsafe-inline'; img-src ${
      webview.cspSource
    } https:; script-src 'nonce-${nonce}';">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Flipper Application Manifest</title>

    <link rel="stylesheet" href="${milligramStyleUri.toString()}">
    <link rel="stylesheet" href="${mainStyleUri.toString()}">

    <script type"application/javascript">
        var properties = ${JSON.stringify(props)};
    </script>
</head>

<body>
    <div class="container">
        <h1>Application Properties Editor</h1>
        <form id="appPropertiesForm">
            <fieldset>
                <div class="row">
                    <div class="column">
                        <label for="appid">App ID:</label>
                        <input type="text" id="appid" name="appid">
                    </div>
                    <div class="column">
                        <label for="name">Name:</label>
                        <input type="text" id="name" name="name">
                    </div>
                </div>
    
                <div class="row">
                    <div class="column">
                        <label for="apptype">App Type:</label>
                        <select id="apptype" name="apptype">
                            <option value="SERVICE">SERVICE</option>
                            <option value="SYSTEM">SYSTEM</option>
                            <option value="APP">APP</option>
                            <option value="PLUGIN">PLUGIN</option>
                            <option value="DEBUG">DEBUG</option>
                            <option value="ARCHIVE">ARCHIVE</option>
                            <option value="SETTINGS">SETTINGS</option>
                            <option value="STARTUP">STARTUP</option>
                            <option value="EXTERNAL" selected>EXTERNAL</option>
                            <option value="METAPACKAGE">METAPACKAGE</option>
                        </select>
                    </div>
                    <div class="column">
                        <label for="entry_point">Entry Point:</label>
                        <input type="text" id="entry_point" name="entry_point">
                    </div>
                </div>
    
                <div class="row">
                    <div class="column">
                        <label for="cdefines">C Defines:</label>
                        <input type="text" id="cdefines" name="cdefines">
                    </div>
                    <div class="column">
                        <label for="stack_size">Stack Size (times 1024):</label>
                        <input type="number" id="stack_size" name="stack_size">
                    </div>
                    <div class="column">
                        <label for="order">Order:</label>
                        <input type="number" id="order" name="order">
                    </div>
                </div>
    
                <div class="row">
                    <div class="column requires-container">
                        <label>Requires</label>
                        <div class="requires-content">
                            <ul id="required-app-ids">
                            </ul>
                            <button type="button" id="editRequires">Edit</button>
                        </div>
                    </div>                    

                    <div class="column">
                        <label for="conflicts">Conflicts:</label>
                        <input type="text" id="conflicts" name="conflicts">
                    </div>
                </div>
    
                <label for="icon">Icon:</label>
                <input type="text" id="icon" name="icon">
                <!--<select id="icon" name="icon">
                    <option value="icon1">Icon 1</option>
                    <option value="icon2">Icon 2</option>
                    <option value="icon3">Icon 3</option>
                    <!-- Add more options as needed --
                </select>-->
    
                <!--<label for="sdk_headers">SDK Headers:</label>
                <input type="text" id="sdk_headers" name="sdk_headers">
    
                <label for="targets">Targets:</label>
                <input type="text" id="targets" name="targets">-->
    
                <label for="resources">Resources:</label>
                <input type="text" id="resources" name="resources">
    
                <!--<label for="sources">Sources:</label>
                <input type="text" id="sources" name="sources">-->
    
                <label for="fap_version">FAP Version:</label>
                <input type="text" id="fap_version" name="fap_version">
    
                <label for="fap_icon">FAP Icon:</label>
                <input type="text" id="fap_icon" name="fap_icon">
    
                <!--<label for="fap_libs">FAP Libs:</label>
                <input type="text" id="fap_libs" name="fap_libs">-->
    
                <label for="fap_category">FAP Category:</label>
                <input type="text" id="fap_category" name="fap_category">
    
                <label for="fap_description">FAP Description:</label>
                <input type="text" id="fap_description" name="fap_description">
    
                <label for="fap_author">FAP Author:</label>
                <input type="text" id="fap_author" name="fap_author">
    
                <label for="fap_weburl">FAP Web URL:</label>
                <input type="text" id="fap_weburl" name="fap_weburl">
    
                <label for="fap_icon_assets">FAP Icon Assets:</label>
                <input type="text" id="fap_icon_assets" name="fap_icon_assets">
    
                <!--<label for="fap_extbuild">FAP External Build:</label>
                <input type="text" id="fap_extbuild" name="fap_extbuild">-->
    
                <div class="float-right">
                    <input type="checkbox" id="fal_embedded" name="fal_embedded">
                    <label class="label-inline" for="fal_embedded">FAL Embedded</label>
                </div>
    
                <!--<button type="submit" id="submitBtn">Submit</button>-->
            </fieldset>
        </form>
    </div>

    <div id="requiresModal" class="modal">
        <div class="modal-content">
            <span class="close">&times;</span>
            <h3>Required application IDs</h3>
            <div id="requiresModalContent" class="grid-container">
                <!-- Required items will be dynamically added here -->
            </div>
            <div class="input-group">
                <input type="text" id="newRequire" placeholder="Enter new required application ID">
                <button type="button" id="addRequireModal">Add</button>
            </div>
        </div>
    </div>

    <script nonce="${nonce}" src="${mainScriptUri.toString()}"></script>
</body>
</html>
`;
  }

  private _requestId = 1;
  private readonly _callbacks = new Map<
    number,
    (response: string | number[]) => void
  >();

  private async postMessageWithResponse(
    panel: WebviewPanel,
    type: string,
    body: string
  ): Promise<string | number[] | FamDocumentProperties> {
    const requestId = this._requestId++;
    const p = new Promise<string | number[] | FamDocumentProperties>(resolve =>
      this._callbacks.set(requestId, resolve)
    );
    await panel.webview.postMessage({ type, requestId, body });

    return p;
  }

  private async postMessage(
    panel: WebviewPanel,
    type: string,
    body: string
  ): Promise<void> {
    await panel.webview.postMessage({ type, body });
  }

  private onMessage(document: FamDocument, message: WebviewMessage): void {
    switch (message.type) {
      case "value-change":
        document.makeEdit(message as unknown as FamDocumentEdit);

        return;

      case "response": {
        const callback = this._callbacks.get(message.requestId);
        callback?.(message.body); // Fix: Cast message.body to string

        return;
      }
    }
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
