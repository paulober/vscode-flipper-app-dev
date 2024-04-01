import { Command } from "./command.mjs";
import {
  checkRequirements,
  showRequirementsNotMetErrors,
} from "../firmware/requirements.mjs";
import FirmwareSDKManager from "../firmware/sdkManager.mjs";
import { getLatestCommitHash } from "../helper/githubAPI.mjs";
import {
  EXTENSION_NAME,
  OFW_GITHUB_BRANCH,
  OFW_GITHUB_OWNER,
  OFW_GITHUB_REPO,
} from "../constants.mjs";
import { commands, window } from "vscode";
import InstallSDKCommand from "./installSDK.mjs";

export default class NewAppCommand extends Command {
  public static readonly id = "newApp";

  constructor() {
    super(NewAppCommand.id);
  }

  async execute(): Promise<void> {
    console.log("Creating a new app...");
    const result = await checkRequirements();
    if (await showRequirementsNotMetErrors(result)) {
      return;
    }

    const selectedSDK: string = await commands.executeCommand(
      EXTENSION_NAME + "." + InstallSDKCommand.id
    );
    if (selectedSDK === "") {
      return;
    }

    const appName = await window.showInputBox({
      prompt: "Please enter the name of your new app",
      placeHolder: "App Name",
    });

    if (appName === undefined) {
      return;
    }

    // no whitespaces, only letters, numbers, and underscores
    const appId = await window.showInputBox({
      prompt: "Please enter the ID of your new app",
      placeHolder: "app_id",
      validateInput: input => {
        if (!input.match(/^[a-zA-Z0-9_]+$/)) {
          return "Only letters, numbers, and underscores are allowed";
        }

        return null;
      },
    });

    if (appId === undefined) {
      return;
    }

    await FirmwareSDKManager.createNewApp(selectedSDK, appName, appId);
  }
}
