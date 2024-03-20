import { Command } from "./command.mjs";
import {
  checkRequirements,
  showRequirementsNotMetErrors,
} from "../firmware/requirements.mjs";
import FirmwareSDKManager from "../firmware/sdkManager.mjs";

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

    const latestDevVersion = await FirmwareSDKManager.getLatestDevVersion();
    console.log(`Latest dev version: ${latestDevVersion} will be used.`);

    try {
      await FirmwareSDKManager.installDevSDK(latestDevVersion);
      console.log("Dev SDK installed successfully.");
    } catch (error) {
      console.error("Error installing dev SDK:", error);
    }
  }
}
