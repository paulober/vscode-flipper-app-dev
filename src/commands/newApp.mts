import { Command } from "./command.mjs";

export default class NewAppCommand extends Command {
  public static readonly id = "newApp";

  constructor() {
    super(NewAppCommand.id);
  }

  execute(): void {
    console.log("Creating a new app...");
  }
}
