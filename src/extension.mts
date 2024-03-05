import { type ExtensionContext } from "vscode";
import type {
  Command,
  CommandWithArgs,
  CommandWithResult,
} from "./commands/command.mjs";
import NewAppCommand from "./commands/newApp.mjs";

export function activate(context: ExtensionContext): void {
  const COMMANDS: Array<Command | CommandWithResult<string> | CommandWithArgs> =
    [new NewAppCommand()];

  COMMANDS.forEach(command => {
    context.subscriptions.push(command.register());
  });
}

export function deactivate(): void {}
