import { Command } from "./command.mjs";
import { type Terminal, window, workspace } from "vscode";
import { join as joinPosix } from "path/posix";
import { SDKS_FOLDER_NAME } from "../constants.mjs";
import { homedir } from "os";
import { dirname } from "path";
import { getTemplatesRoot } from "../helper/fsHelper.mjs";

let terminal: Terminal | undefined;

function runCommandInTerminal(command: string, arg: string): void {
  if (terminal) {
    terminal.dispose();
  }

  terminal = window.createTerminal({
    cwd: dirname(command),
    shellPath:
      getTemplatesRoot() +
      `/shell${process.platform === "win32" ? ".cmd" : ".sh"}`,
    shellArgs: [command, arg],
    name: "Flipper Application Package build",
    isTransient: true,
  });
  /*terminal = window.createTerminal(
    "Flipper Application Package build",
    command,
    [arg]
  );*/

  // Show the terminal
  terminal.show();
}

export default class BuildFapCommand extends Command {
  public static readonly id = "buildFap";

  constructor() {
    super(BuildFapCommand.id);
  }

  async execute(): Promise<void> {
    // get appid=<appid>, from application.fam in workspace
    const files = await workspace.findFiles("**/application.fam", undefined, 1);
    if (files.length < 1) {
      void window.showErrorMessage("No application.fam found in workspace.");

      return;
    }

    for (const file of files) {
      const content = await workspace.fs.readFile(file);
      const contentString = Buffer.from(content).toString("utf-8");
      const appidMatch = contentString.match(/appid="([a-zA-Z0-9_-]+)"/);

      if (!appidMatch) {
        void window.showErrorMessage("No appid found in application.fam.");

        return;
      }

      const appId = appidMatch[1];
      const sdk = file.fsPath
        .replaceAll("\\", "/")
        .replaceAll("//", "/")
        .match(/\.flipper-sdk\/([a-zA-Z0-9_\-.]+)\//);

      if (!sdk) {
        void window.showWarningMessage(
          "The extension currently only supports projects in SDKs " +
            "downloaded and installed my the extension."
        );
        continue;
      }

      runCommandInTerminal(
        joinPosix(homedir(), SDKS_FOLDER_NAME, sdk[1], "fbt"),
        `fap_${appId}`
      );

      // execute build command

      /*const { stdout, stderr } = await execAsync(buildCommand, {
        cwd: joinPosix(homedir(), SDKS_FOLDER_NAME, sdk[1]),
        timeout: 60000,
      });

      if (!stderr) {
        void window.showInformationMessage(
          `Successfully built FAP for app with ID ${appId}`
        );
      } else {
        void window.showErrorMessage(
          `Failed to build FAP for app with ID ${appId}`
        );
      }*/
    }
  }
}
