import { Command } from "./command.mjs";
import { type Terminal, window, workspace, commands } from "vscode";
import {
  join as joinPosix,
  relative as relativePosix,
  dirname as dirnamePosix,
} from "path/posix";
import { EXTENSION_NAME, SDKS_FOLDER_NAME } from "../constants.mjs";
import { homedir } from "os";
import { dirname } from "path";

let terminal: Terminal | undefined;

async function runCommandInTerminal(
  command: string,
  args: string[]
): Promise<void> {
  if (terminal) {
    terminal.dispose();
  }

  terminal = window.createTerminal({
    cwd: dirname(command),
    shellPath: command,
    /*getTemplatesRoot() +
      `/shell${process.platform === "win32" ? ".cmd" : ".sh"}`*/ shellArgs:
      args,
    name: "Launch Flipper Application Package",
    isTransient: true,
  });

  // Show the terminal
  terminal.show();

  // wait for terminal to close
  return new Promise<void>(resolve => {
    window.onDidCloseTerminal(t => {
      if (t.processId === terminal?.processId) {
        resolve();
      }
    });
  });
}

export default class LaunchFapCommand extends Command {
  public static readonly id = "launchFap";

  constructor() {
    super(LaunchFapCommand.id);
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

    await runCommandInTerminal(
      joinPosix(homedir(), SDKS_FOLDER_NAME, sdk[1], "fbt"),
      [
        "launch",
        `APPSRC=./${relativePosix(
          joinPosix(homedir(), SDKS_FOLDER_NAME, sdk[1]),
          dirnamePosix(file.fsPath)
        )}`,
      ]
    );

    await commands.executeCommand(`${EXTENSION_NAME}.openSerial`);
  }
}
