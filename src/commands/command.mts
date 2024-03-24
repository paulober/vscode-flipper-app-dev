import { commands, type Disposable } from "vscode";
import { EXTENSION_NAME } from "../constants.mjs";

export abstract class Command {
  private readonly commandId: string;

  protected constructor(commandId: string) {
    this.commandId = commandId;
  }

  register(): Disposable {
    return commands.registerCommand(
      EXTENSION_NAME + "." + this.commandId,
      this.execute.bind(this)
    );
  }

  abstract execute(): Promise<void> | void;
}

export abstract class CommandWithResult<T> {
  private readonly commandId: string;

  protected constructor(commandId: string) {
    this.commandId = commandId;
  }

  register(): Disposable {
    return commands.registerCommand(
      EXTENSION_NAME + "." + this.commandId,
      this.execute.bind(this)
    );
  }

  abstract execute(): Promise<T> | T;
}

export abstract class CommandWithArgs {
  private readonly commandId: string;

  protected constructor(commandId: string) {
    this.commandId = commandId;
  }

  register(): Disposable {
    return commands.registerCommand(
      EXTENSION_NAME + "." + this.commandId,
      this.execute.bind(this)
    );
  }

  abstract execute(...args: unknown[]): Promise<void> | void;
}
