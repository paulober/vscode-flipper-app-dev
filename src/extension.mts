import { window, workspace, type ExtensionContext } from "vscode";
import type {
  Command,
  CommandWithArgs,
  CommandWithResult,
} from "./commands/command.mjs";
import NewAppCommand from "./commands/newApp.mjs";
import CleanCommand from "./commands/clean.mjs";
import { FamEditorProvider } from "./editor/famEditor.mjs";
import SwitchSDKCommand from "./commands/switchSDK.mjs";
import BuildFapCommand from "./commands/buildFap.mjs";
import { setupStatusbar } from "./helper/uiHelper.mjs";
import LaunchFapCommand from "./commands/launchFap.mjs";
import OpenSerialCommand from "./commands/openSerial.mjs";
import { installUfbt } from "./helper/ufbt.mjs";
import {
  checkRequirements,
  showRequirementsNotMetErrors,
} from "./firmware/requirements.mjs";
import { FlipperAppDevProvider } from "./activitybar/flipperAppDevProvider.mjs";
import { EXTENSION_NAME } from "./constants.mjs";

export async function activate(context: ExtensionContext): Promise<void> {
  if (await showRequirementsNotMetErrors(await checkRequirements())) {
    return;
  }

  await installUfbt();

  const COMMANDS: Array<Command | CommandWithResult<string> | CommandWithArgs> =
    [
      new NewAppCommand(),
      new CleanCommand(),
      new SwitchSDKCommand(),
      new BuildFapCommand(),
      new LaunchFapCommand(),
      new OpenSerialCommand(),
    ];

  COMMANDS.forEach(command => {
    context.subscriptions.push(command.register());
  });

  context.subscriptions.push(FamEditorProvider.register(context));

  const rootPath =
    workspace.workspaceFolders && workspace.workspaceFolders.length > 0
      ? workspace.workspaceFolders[0].uri.fsPath
      : undefined;
  const flipperAppDevProvider = new FlipperAppDevProvider(rootPath);

  context.subscriptions.push(
    window.registerTreeDataProvider(
      `${EXTENSION_NAME}-quick-access`,
      flipperAppDevProvider
    )
  );

  await setupStatusbar(context);
}

export function deactivate(): void {}
