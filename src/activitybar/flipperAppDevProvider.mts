import {
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
} from "vscode";
import { UfbtSDKBranch } from "../helper/ufbt.mjs";
import { EXTENSION_NAME } from "../constants.mjs";
import SwitchSDKCommand from "../commands/switchSDK.mjs";

export class SDKBranch extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly branch: UfbtSDKBranch,
    public readonly collapsibleState: TreeItemCollapsibleState
  ) {
    super(label, collapsibleState);

    this.tooltip = `Switch to ${this.branch} SDK`;
    this.description = this.branch;
    this.iconPath = new ThemeIcon("git-branch");
  }

  contextValue = "sdkBranch";
}

export class FlipperAppDevProvider implements TreeDataProvider<SDKBranch> {
  constructor(private workspaceRoot?: string) {}

  getTreeItem(element: SDKBranch): TreeItem {
    element.command = {
      command: `${EXTENSION_NAME}.${SwitchSDKCommand.id}`,
      title: "Switch SDK",
      arguments: [element.branch],
    };
    return element;
  }

  getChildren(element?: SDKBranch | undefined): ProviderResult<SDKBranch[]> {
    if (element || !this.workspaceRoot) {
      return;
    }

    return [
      new SDKBranch(
        "Release",
        UfbtSDKBranch.release,
        TreeItemCollapsibleState.None
      ),
      new SDKBranch("Beta", UfbtSDKBranch.rc, TreeItemCollapsibleState.None),
      new SDKBranch(
        "Development",
        UfbtSDKBranch.dev,
        TreeItemCollapsibleState.None
      ),
    ];
  }
}
