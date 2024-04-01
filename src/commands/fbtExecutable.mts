import { SDKS_FOLDER_NAME } from "../constants.mjs";
import { CommandWithResult } from "./command.mjs";
import { workspace } from "vscode";
import { join as joinPosix } from "path/posix";
import { homedir } from "os";

export default class FbtExecutableCommand extends CommandWithResult<string> {
  public static readonly id = "fbtExecutable";

  constructor() {
    super(FbtExecutableCommand.id);
  }

  async execute(): Promise<string> {
    const files = await workspace.findFiles("**/application.fam", undefined, 1);

    if (files.length < 1) {
      return "";
    }

    const matches = files[0].fsPath
      .replaceAll("\\", "/")
      .replaceAll("//", "/")
      .match(/\.flipper-sdk\/([a-zA-Z0-9_\-.]+)\//);

    if (!matches) {
      return "";
    }

    return joinPosix(homedir(), SDKS_FOLDER_NAME, matches[0], "fbt") +
      process.platform ===
      "win32"
      ? ".cmd"
      : "";
  }
}
