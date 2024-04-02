import { Command } from "./command.mjs";
import { ufbtCli } from "../helper/ufbt.mjs";

export default class OpenSerialCommand extends Command {
  public static readonly id = "openSerial";

  constructor() {
    super(OpenSerialCommand.id);
  }

  execute(): void {
    ufbtCli();
  }
}
