import { CommandWithArgs } from "./command.mjs";
import FirmwareSDKManager from "../firmware/sdkManager.mjs";
import type { SDKItem } from "../activitybar/sdkManagement.mjs";
import { window } from "vscode";

export default class DeleteSDKCommand extends CommandWithArgs {
  public static readonly id = "deleteSDK";

  constructor() {
    super(DeleteSDKCommand.id);
  }

  async execute(sdk?: SDKItem): Promise<void> {
    let sdk1ShaOrTag: string | undefined;
    if (!sdk) {
      const installedSDKs = await FirmwareSDKManager.listInstalledSDKs();

      if (installedSDKs.length === 0) {
        void window.showInformationMessage("No SDKs installed.");

        return;
      }

      // TODO: better representation of sdks like in treeview
      const sdkItem = await window.showQuickPick(
        installedSDKs.map(sdk => sdk.slice(0, 7)),
        {
          placeHolder: "Select an SDK to delete",
        }
      );

      if (!sdkItem) {
        return;
      }

      sdk1ShaOrTag = sdkItem;
    } else {
      sdk1ShaOrTag = sdk.ghRelease?.tag_name ?? sdk.sha1;
    }

    if (!sdk1ShaOrTag) {
      return;
    }

    await FirmwareSDKManager.deleteSDK(sdk1ShaOrTag);
    void window.showInformationMessage(
      `SDK ${sdk1ShaOrTag.slice(0, 7)} deleted.`
    );
  }
}
