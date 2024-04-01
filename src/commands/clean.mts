import { Command } from "./command.mjs";
import { ufbtClean } from "../helper/ufbt.mjs";

export default class CleanCommand extends Command {
  public static readonly id = "clean";

  constructor() {
    super(CleanCommand.id);
  }

  async execute(): Promise<void> {
    await ufbtClean();
  }
}
