import { window, type QuickPickItem } from "vscode";
import { Command, CommandWithResult } from "./command.mjs";
import {
  type GHRelease,
  getLatestCommitHash,
  getLatestPreRelease,
  getLatestRelease,
} from "../helper/githubAPI.mjs";
import {
  OFW_GITHUB_BRANCH,
  OFW_GITHUB_OWNER,
  OFW_GITHUB_REPO,
} from "../constants.mjs";
import FirmwareSDKManager from "../firmware/sdkManager.mjs";

class SDKQuickPickItem implements QuickPickItem {
  public readonly description?: string;

  constructor(
    public readonly label: string,
    public readonly ghRelease?: GHRelease,
    public readonly sha1?: string
  ) {
    this.description = ghRelease?.tag_name ?? sha1?.slice(0, 7);
  }
}

async function getCurrentSDKs(): Promise<SDKQuickPickItem[]> {
  const latestDevRelease = await getLatestCommitHash(
    OFW_GITHUB_OWNER,
    OFW_GITHUB_REPO,
    OFW_GITHUB_BRANCH
  );
  const latestRelease = await getLatestRelease(
    OFW_GITHUB_OWNER,
    OFW_GITHUB_REPO
  );
  const latestPreRelease = await getLatestPreRelease(
    OFW_GITHUB_OWNER,
    OFW_GITHUB_REPO
  );

  const sdks = [];
  if (latestRelease) {
    sdks.push(new SDKQuickPickItem("OFW Stable SDK", latestRelease));
  }

  if (latestPreRelease) {
    sdks.push(new SDKQuickPickItem("OFW Beta SDK", latestPreRelease));
  }

  if (latestDevRelease) {
    sdks.push(new SDKQuickPickItem("OFW Dev SDK", undefined, latestDevRelease));
  }

  return sdks;
}

export default class InstallSDKCommand extends CommandWithResult<string> {
  public static readonly id = "installSDK";

  constructor() {
    super(InstallSDKCommand.id);
  }

  async execute(): Promise<string> {
    const currentSDKs = await getCurrentSDKs();
    const sdkItem = await window.showQuickPick<SDKQuickPickItem>(currentSDKs, {
      placeHolder: "Select an SDK to install",
      canPickMany: false,
      ignoreFocusOut: false,
      matchOnDescription: true,
      title: "Install Flipper SDK",
    });

    if (sdkItem) {
      if (sdkItem.sha1) {
        const result = await FirmwareSDKManager.installSDKFromGit(
          OFW_GITHUB_OWNER,
          OFW_GITHUB_REPO,
          OFW_GITHUB_BRANCH,
          sdkItem.sha1
        );

        if (result) {
          void window.showInformationMessage(
            `Installed SDK ${sdkItem.sha1} successfully.`
          );

          return sdkItem.sha1;
        } else {
          void window.showErrorMessage(
            `Failed to install SDK ${sdkItem.sha1}.`
          );
        }
      } else if (sdkItem.ghRelease) {
        /*const result = await FirmwareSDKManager.installSDK(
          OFW_GITHUB_OWNER,
          OFW_GITHUB_REPO,
          sdkItem.ghRelease
        );*/
        const result = await FirmwareSDKManager.installSDKFromGit(
          OFW_GITHUB_OWNER,
          OFW_GITHUB_REPO,
          OFW_GITHUB_BRANCH,
          undefined,
          sdkItem.ghRelease
        );

        if (result) {
          void window.showInformationMessage(
            `Installed SDK ${sdkItem.ghRelease.tag_name} successfully.`
          );

          return sdkItem.ghRelease.tag_name;
        } else {
          void window.showErrorMessage(
            `Failed to install SDK ${sdkItem.ghRelease.tag_name}.`
          );
        }
      } else {
        void window.showWarningMessage("No SDK selected.");
      }
    } else {
      void window.showWarningMessage("No SDK selected.");
    }

    return "";
  }
}
