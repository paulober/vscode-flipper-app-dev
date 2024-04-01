import { Command } from "./command.mjs";
import { type Terminal, window, workspace } from "vscode";
import { join as joinPosix } from "path/posix";
import { SDKS_FOLDER_NAME } from "../constants.mjs";
import { homedir } from "os";
import { dirname } from "path";

let flipperTerminal: Terminal | undefined;

function runCommandInTerminal(command: string, args: string[]): void {
  if (flipperTerminal) {
    flipperTerminal.dispose();
  }

  flipperTerminal = window.createTerminal({
    cwd: dirname(command),
    env: {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      FBT_NO_SYNC: "0",
    },
    shellPath: command,
    shellArgs: [command, ...args],
    name: "Flipper Serial Console",
    isTransient: true,
  });
  /*terminal = window.createTerminal(
    "Flipper Application Package build",
    command,
    [arg]
  );*/

  // Show the terminal
  flipperTerminal.show();
}

export default class OpenSerialCommand extends Command {
  public static readonly id = "openSerial";

  constructor() {
    super(OpenSerialCommand.id);
  }

  async execute(): Promise<void> {
    // get appid=<appid>, from application.fam in workspace
    const files = await workspace.findFiles("**/application.fam", undefined, 1);
    if (files.length < 1) {
      void window.showErrorMessage("No application.fam found in workspace.");

      return;
    }

    const file = files[0];
    const content = await workspace.fs.readFile(file);
    const contentString = Buffer.from(content).toString("utf-8");
    const appidMatch = contentString.match(/appid="([a-zA-Z0-9_-]+)"/);

    if (!appidMatch) {
      void window.showErrorMessage("No appid found in application.fam.");

      return;
    }

    const sdk = file.fsPath
      .replaceAll("\\", "/")
      .replaceAll("//", "/")
      .match(/\.flipper-sdk\/([a-zA-Z0-9_\-.]+)\//);

    if (!sdk) {
      void window.showWarningMessage(
        "The extension currently only supports projects in SDKs " +
          "downloaded and installed my the extension."
      );

      return;
    }

    runCommandInTerminal(
      joinPosix(homedir(), SDKS_FOLDER_NAME, sdk[1], "fbt"),
      ["cli"]
    );
  }
}
