import { window } from "vscode";
import { CommandWithArgs } from "./command.mjs";
import { UfbtSDKBranch, ufbtSwitchSDK } from "../helper/ufbt.mjs";

export default class SwitchSDKCommand extends CommandWithArgs {
  public static readonly id = "switchSDK";

  constructor() {
    super(SwitchSDKCommand.id);
  }

  async execute(branch?: UfbtSDKBranch): Promise<void> {
    if (branch) {
      const result = await window.showQuickPick(
        ["$(check) Yes", "$(chrome-close) No"],
        {
          placeHolder: `Do you realy want to switch your selected SDK to the ${branch} branch?`,
          canPickMany: false,
          ignoreFocusOut: false,
          title: "Switch SDK",
        }
      );

      if (result === undefined || result === "No") {
        return;
      }

      await ufbtSwitchSDK(branch);

      return;
    }

    const sdkBranch = await window.showQuickPick(
      ["Release", "Release-candidate", "Dev"],
      {
        placeHolder: "Select the SDK branch",
        canPickMany: false,
        ignoreFocusOut: false,
        title: "Create new flipper app",
      }
    );

    if (sdkBranch === undefined) {
      return;
    }

    switch (sdkBranch) {
      case "Release":
        await ufbtSwitchSDK(UfbtSDKBranch.release);
        break;
      case "Release-candidate":
        await ufbtSwitchSDK(UfbtSDKBranch.rc);
        break;
      case "Dev":
        await ufbtSwitchSDK(UfbtSDKBranch.dev);
        break;
    }
  }
}
