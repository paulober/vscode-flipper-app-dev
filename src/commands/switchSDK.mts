import { window } from "vscode";
import { CommandWithArgs } from "./command.mjs";
import { UfbtSDKBranch, ufbtSwitchSDK } from "../helper/ufbt.mjs";
// eslint-disable-next-line max-len
import type { FlipperAppDevProvider } from "../activitybar/flipperAppDevProvider.mjs";

export default class SwitchSDKCommand extends CommandWithArgs {
  public static readonly id = "switchSDK";

  constructor(private readonly _flipperAppDevProvider: FlipperAppDevProvider) {
    super(SwitchSDKCommand.id);
  }

  async execute(branch?: UfbtSDKBranch): Promise<void> {
    if (branch) {
      const result = await window.showQuickPick(
        ["$(check) Yes", "$(chrome-close) No"],
        {
          placeHolder:
            "Do you realy want to switch your selected " +
            `SDK to the ${branch} branch?`,
          canPickMany: false,
          ignoreFocusOut: false,
          title: "Switch SDK",
        }
      );

      if (result === undefined || result === "No") {
        return;
      }

      ufbtSwitchSDK(branch);
      // wait 2 seconds
      await new Promise(resolve => setTimeout(resolve, 2000));
      this._flipperAppDevProvider.refresh();

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
        ufbtSwitchSDK(UfbtSDKBranch.release);
        break;
      case "Release-candidate":
        ufbtSwitchSDK(UfbtSDKBranch.rc);
        break;
      case "Dev":
        ufbtSwitchSDK(UfbtSDKBranch.dev);
        break;
    }

    // wait 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    this._flipperAppDevProvider.refresh();
  }
}
