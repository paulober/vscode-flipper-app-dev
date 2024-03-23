import { type ExtensionContext } from "vscode";
import type {
  Command,
  CommandWithArgs,
  CommandWithResult,
} from "./commands/command.mjs";
import NewAppCommand from "./commands/newApp.mjs";
import FirmwareSDKManager from "./firmware/sdkManager.mjs";
import CleanCommand from "./commands/clean.mjs";
import { FamEditorProvider } from "./editor/famEditor.mjs";

export async function activate(context: ExtensionContext): Promise<void> {
  const COMMANDS: Array<Command | CommandWithResult<string> | CommandWithArgs> =
    [new NewAppCommand(), new CleanCommand()];

  COMMANDS.forEach(command => {
    context.subscriptions.push(command.register());
  });

  context.subscriptions.push(FamEditorProvider.register(context));

  await FirmwareSDKManager.createDevWorkspace();
}

export function deactivate(): void {}
