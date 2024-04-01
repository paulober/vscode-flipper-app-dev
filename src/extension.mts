import { window, type ExtensionContext } from "vscode";
import type {
  Command,
  CommandWithArgs,
  CommandWithResult,
} from "./commands/command.mjs";
import NewAppCommand from "./commands/newApp.mjs";
import FirmwareSDKManager from "./firmware/sdkManager.mjs";
import CleanCommand from "./commands/clean.mjs";
import { FamEditorProvider } from "./editor/famEditor.mjs";
import InstallSDKCommand from "./commands/installSDK.mjs";
import SwitchSDKCommand from "./commands/switchSDK.mjs";
import CompileAppCommand from "./commands/compileApp.mjs";
import SDKManagementTreeDataProvider from "./activitybar/sdkManagement.mjs";

export async function activate(context: ExtensionContext): Promise<void> {
  const COMMANDS: Array<Command | CommandWithResult<string> | CommandWithArgs> =
    [
      new NewAppCommand(),
      new CleanCommand(),
      new CompileAppCommand(),
      new InstallSDKCommand(),
      new SwitchSDKCommand(),
    ];

  COMMANDS.forEach(command => {
    context.subscriptions.push(command.register());
  });

  context.subscriptions.push(FamEditorProvider.register(context));

  const sdkManagementWebviewProvider = new SDKManagementTreeDataProvider();

  context.subscriptions.push(
    window.registerTreeDataProvider(
      SDKManagementTreeDataProvider.viewId,
      sdkManagementWebviewProvider
    )
  );

  await FirmwareSDKManager.createDevWorkspace();
}

export function deactivate(): void {}
