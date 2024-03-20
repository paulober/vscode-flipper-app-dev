import { Command } from "./command.mjs";
import FirmwareSDKManager from "../firmware/sdkManager.mjs";

export default class CleanCommand extends Command {
  public static readonly id = "clean";

  constructor() {
    super(CleanCommand.id);
  }

  async execute(): Promise<void> {
    const installedSDKs = await FirmwareSDKManager.listInstalledSDKs();

    if (installedSDKs.length === 0) {
      return;
    }
    installedSDKs.forEach(sdk => {
      void FirmwareSDKManager.deleteDevSDK(sdk);
    });
  }
}
