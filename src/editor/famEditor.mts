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

interface FamDocumentEdit {
  readonly property: string;
  readonly value: string;
}

interface FamDocumentDelegate {
  getFileData(): Promise<Uint8Array>;
}

interface WebviewMessage {
  readonly type: string;
  readonly requestId: number;
  readonly body: string;
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
  }

  public get uri(): Uri {
    return this._uri;
  }

  public get documentData(): Uint8Array {
    return this._documentData;
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
  private static readonly viewType = "flipper-zero.famEdit";
  private readonly webviews = new WebviewCollection();

  public static register(context: ExtensionContext): Disposable {
    commands.registerCommand("flipper-zero.famEdit.new", () => {
      const workspaceFolders = workspace.workspaceFolders;
      if (!workspaceFolders) {
        void window.showErrorMessage("No workspace folder is open.");

        return;
      }

      const uri = Uri.joinPath(
        workspaceFolders[0].uri,
        `new-${FamEditorProvider.newFamFieldId++}.fam`
      ).with({ scheme: "untitled" });

      void commands.executeCommand(
        "vscode.openWith",
        uri,
        FamEditorProvider.newFamFieldId
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

  public async openCustomDocument(
    uri: Uri,
    openContext: CustomDocumentOpenContext,
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
          )) as number[];

          return new Uint8Array(response);
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
    token: CancellationToken
  ): void {
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage((e: WebviewMessage) =>
      this.onMessage(document, e)
    );

    // Wait for the webview to be properly readoy before we init it
    webviewPanel.webview.onDidReceiveMessage((e: WebviewMessage) => {
      if (e.type === "ready") {
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
            JSON.stringify({ value: document.documentData, editable })
          );
        }
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

  private getHtmlForWebview(webview: Webview): string {
    return "";
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
  ): Promise<string | number[]> {
    const requestId = this._requestId++;
    const p = new Promise<string | number[]>(resolve =>
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
