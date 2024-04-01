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
import DeleteSDKCommand from "./commands/deleteSDK.mjs";
import FbtExecutableCommand from "./commands/fbtExecutable.mjs";
import ScriptsFolderCommand from "./commands/scriptsFolder.mjs";
import BuildFapCommand from "./commands/buildFap.mjs";
import { setupStatusbar } from "./helper/uiHelper.mjs";
import BuildFolderCommand from "./commands/buildFolder.mjs";
import LaunchFapCommand from "./commands/launchFap.mjs";
import OpenSerialCommand from "./commands/openSerial.mjs";

export async function activate(context: ExtensionContext): Promise<void> {
  const COMMANDS: Array<Command | CommandWithResult<string> | CommandWithArgs> =
    [
      new NewAppCommand(),
      new CleanCommand(),
      new CompileAppCommand(),
      new InstallSDKCommand(),
      new DeleteSDKCommand(),
      new SwitchSDKCommand(),
      new FbtExecutableCommand(),
      new ScriptsFolderCommand(),
      new BuildFolderCommand(),
      new BuildFapCommand(),
      new LaunchFapCommand(),
      new OpenSerialCommand(),
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

  await setupStatusbar(context);
}

export function deactivate(): void {}
