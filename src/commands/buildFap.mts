import { Command } from "./command.mjs";
import { ufbtBuild } from "../helper/ufbt.mjs";

export default class BuildFapCommand extends Command {
  public static readonly id = "buildFap";

  constructor() {
    super(BuildFapCommand.id);
  }

  execute(): void {
    ufbtBuild();
  }
}
