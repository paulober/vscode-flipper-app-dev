import { Command } from "./command.mjs";
import { ufbtLaunch } from "../helper/ufbt.mjs";

export default class LaunchFapCommand extends Command {
  public static readonly id = "launchFap";

  constructor() {
    super(LaunchFapCommand.id);
  }

  execute(): void {
    ufbtLaunch();
  }
}
