import {
  type Command,
  TreeItem,
  type Event,
  TreeItemCollapsibleState,
  type TreeDataProvider,
  EventEmitter,
  ThemeIcon,
} from "vscode";
import NewAppCommand from "../commands/newApp.mjs";
import { FamEditorProvider } from "../editor/famEditor.mjs";
import { EXTENSION_NAME } from "../constants.mjs";
import SwitchSDKCommand from "../commands/switchSDK.mjs";
import CompileAppCommand from "../commands/compileApp.mjs";

export class QuickAccessCommand extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly command?: Command
  ) {
    super(label, collapsibleState);
  }
}

const COMMON_COMMANDS_PARENT_LABEL = "General";
const PROJECT_COMMANDS_PARENT_LABEL = "Project";
const DOCUMENTATION_COMMANDS_PARENT_LABEL = "Documentation";

const NEW_APP_LABEL = "New Flipper App";
const NEW_FLIPPER_APPLICATION_MANIFEST_LABEL =
  "New Flipper Application Manifest";
const SWITCH_SDK_LABEL = "Switch SDK";
const COMPILE_PROJECT_LABEL = "Compile App";

export class FlipperAppDevActivityBarQuickAccess
  implements TreeDataProvider<QuickAccessCommand>
{
  public static readonly viewType = `${EXTENSION_NAME}-quick-access`;
  private _sdkVersion: string = "N/A";

  private _onDidChangeTreeData = new EventEmitter<
    QuickAccessCommand | undefined | void
  >();
  readonly onDidChangeTreeData: Event<QuickAccessCommand | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor() {}

  public refresh(newPicoSDKVersion?: string): void {
    if (newPicoSDKVersion) {
      this._sdkVersion = newPicoSDKVersion;
    }
    this._onDidChangeTreeData.fire();
  }

  public getTreeItem(
    element: QuickAccessCommand
  ): TreeItem | Thenable<TreeItem> {
    switch (element.label) {
      case NEW_APP_LABEL:
        // alt. "new-folder"
        element.iconPath = new ThemeIcon("file-directory-create");
        break;

      case COMPILE_PROJECT_LABEL:
        // alt. "gear", "notifications-configure"
        element.iconPath = new ThemeIcon("file-binary");
        break;

      case SWITCH_SDK_LABEL:
        // repo-forked or extensions; alt. "replace-all"
        element.iconPath = new ThemeIcon("find-replace-all");
        element.description = `Current: ${this._sdkVersion}`;
        break;
    }

    return element;
  }

  public getChildren(
    element?: QuickAccessCommand | undefined
  ): QuickAccessCommand[] {
    if (element === undefined) {
      return [
        new QuickAccessCommand(
          COMMON_COMMANDS_PARENT_LABEL,
          TreeItemCollapsibleState.Expanded
        ),
        new QuickAccessCommand(
          PROJECT_COMMANDS_PARENT_LABEL,
          TreeItemCollapsibleState.Expanded
        ),
        new QuickAccessCommand(
          DOCUMENTATION_COMMANDS_PARENT_LABEL,
          TreeItemCollapsibleState.Expanded
        ),
      ];
    } else if (element.label === COMMON_COMMANDS_PARENT_LABEL) {
      return [
        new QuickAccessCommand(NEW_APP_LABEL, TreeItemCollapsibleState.None, {
          command: `${EXTENSION_NAME}.${NewAppCommand.id}`,
          title: NEW_APP_LABEL,
        }),
        new QuickAccessCommand(
          NEW_FLIPPER_APPLICATION_MANIFEST_LABEL,
          TreeItemCollapsibleState.None,
          {
            command: FamEditorProvider.newViewCommand,
            title: NEW_FLIPPER_APPLICATION_MANIFEST_LABEL,
          }
        ),
      ];
    } else if (element.label === PROJECT_COMMANDS_PARENT_LABEL) {
      return [
        new QuickAccessCommand(
          COMPILE_PROJECT_LABEL,
          TreeItemCollapsibleState.None,
          {
            command: `${EXTENSION_NAME}.${CompileAppCommand.id}`,
            title: COMPILE_PROJECT_LABEL,
          }
        ),
        new QuickAccessCommand(
          SWITCH_SDK_LABEL,
          TreeItemCollapsibleState.None,
          {
            command: `${EXTENSION_NAME}.${SwitchSDKCommand.id}`,
            title: SWITCH_SDK_LABEL,
          }
        ),
      ];
    } else if (element.label === DOCUMENTATION_COMMANDS_PARENT_LABEL) {
      return [];
    } else {
      return [];
    }
  }
}
