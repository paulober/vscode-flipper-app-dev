import { type TreeDataProvider, TreeItem, type Event } from "vscode";
import { EXTENSION_NAME } from "../constants.mjs";
import { type GHRelease } from "../helper/githubAPI.mjs";
import FirmwareSDKManager from "../firmware/sdkManager.mjs";

export class SDKItem extends TreeItem {
  constructor(
    private readonly ghRelease?: GHRelease,
    private readonly sha1?: string
  ) {
    super(
      ghRelease
        ? `${ghRelease.prerelease ? "Prerelease" : "Stable"} SDK ${
            ghRelease.name
          }`
        : `Dev SDK ${sha1?.slice(0, 7) ?? ""}`
    );

    if (ghRelease) {
      this.description = ghRelease.tag_name;
    }
  }
}

export default class SDKManagementTreeDataProvider
  implements TreeDataProvider<SDKItem>
{
  public static readonly viewId = `${EXTENSION_NAME}-sdk-management`;

  public onDidChangeTreeData?:
    | Event<void | SDKItem | SDKItem[] | null | undefined>
    | undefined;

  public getTreeItem(element: SDKItem): TreeItem {
    return element;
  }

  public async getChildren(element?: SDKItem): Promise<SDKItem[]> {
    if (element === undefined) {
      const installedSDKs = await FirmwareSDKManager.listInstalledSDKs();
      const installedSDKItems = installedSDKs
        .map(sdk => {
          if (sdk.length > 20) {
            return new SDKItem(undefined, sdk);
          } else {
            // check if contain info.json inside
            const info = FirmwareSDKManager.getSDKInfo(sdk);

            if (info) {
              return new SDKItem(info);
            }
          }
        })
        .filter(sdk => sdk !== undefined) as SDKItem[];

      return installedSDKItems;
    }

    return [];
  }
}
