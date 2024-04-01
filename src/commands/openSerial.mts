import { Command } from "./command.mjs";
import { type Terminal, window, workspace } from "vscode";
import { join as joinPosix } from "path/posix";
import { SDKS_FOLDER_NAME } from "../constants.mjs";
import { homedir } from "os";
import { dirname } from "path";
import { ufbtCli } from "../helper/ufbt.mjs";

export default class OpenSerialCommand extends Command {
  public static readonly id = "openSerial";

  constructor() {
    super(OpenSerialCommand.id);
  }

  async execute(): Promise<void> {
    await ufbtCli();
  }
}
