import {
  EventEmitter,
  ProviderResult,
  ThemeIcon,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Event,
} from "vscode";
import { UfbtSDKBranch, ufbtGetSelectedChannel } from "../helper/ufbt.mjs";
import { EXTENSION_NAME } from "../constants.mjs";
import SwitchSDKCommand from "../commands/switchSDK.mjs";

export class SDKChannel extends TreeItem {
  constructor(
    public readonly label: string,
    public readonly branch: UfbtSDKBranch,
    public readonly collapsibleState: TreeItemCollapsibleState,
    public readonly selected = false
  ) {
    super(label, collapsibleState);

    this.tooltip = `Switch to ${this.branch} SDK channel`;
    this.description = this.selected ? "Selected" : "";
    this.iconPath = this.selected
      ? new ThemeIcon("check-all")
      : new ThemeIcon("git-branch");
  }

  contextValue = "sdkChannel";
}

export class FlipperAppDevProvider implements TreeDataProvider<SDKChannel> {
  private _onDidChangeTreeData: EventEmitter<SDKChannel | undefined | void> =
    new EventEmitter<SDKChannel | undefined | void>();
  readonly onDidChangeTreeData: Event<SDKChannel | undefined | void> =
    this._onDidChangeTreeData.event;

  constructor(private workspaceRoot?: string) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: SDKChannel): TreeItem {
    element.command = {
      command: `${EXTENSION_NAME}.${SwitchSDKCommand.id}`,
      title: "Switch SDK",
      arguments: [element.branch],
    };
    return element;
  }

  getChildren(element?: SDKChannel | undefined): ProviderResult<SDKChannel[]> {
    if (element || !this.workspaceRoot) {
      return;
    }

    const selectedChannel = ufbtGetSelectedChannel();

    return [
      new SDKChannel(
        "Release",
        UfbtSDKBranch.release,
        TreeItemCollapsibleState.None,
        selectedChannel === UfbtSDKBranch.release
      ),
      new SDKChannel(
        "Beta",
        UfbtSDKBranch.rc,
        TreeItemCollapsibleState.None,
        selectedChannel === UfbtSDKBranch.rc
      ),
      new SDKChannel(
        "Development",
        UfbtSDKBranch.dev,
        TreeItemCollapsibleState.None,
        selectedChannel === UfbtSDKBranch.dev
      ),
    ];
  }
}
