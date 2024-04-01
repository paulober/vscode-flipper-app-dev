import { Command } from "./command.mjs";
import { installUfbt, ufbtNewApp } from "../helper/ufbt.mjs";
import { window } from "vscode";
import { mkdir } from "fs/promises";
import { join } from "path";

export default class NewAppCommand extends Command {
  public static readonly id = "newApp";

  constructor() {
    super(NewAppCommand.id);
  }

  async execute(): Promise<void> {
    await installUfbt();

    // no whitespaces, only letters, numbers, and underscores
    const appId = await window.showInputBox({
      prompt: "Please enter the ID of your new app",
      placeHolder: "app_id",
      validateInput: input => {
        if (!input.match(/^[a-zA-Z0-9_]+$/)) {
          return "Only letters, numbers, and underscores are allowed";
        }

        return null;
      },
    });

    if (appId === undefined) {
      return;
    }

    const folders = await window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: "Select Folder",
      title: "Select Folder root where the app should be created",
    });

    if (folders === undefined || folders.length !== 1) {
      return;
    }

    // create app_id in folders
    await mkdir(join(folders[0].fsPath, appId));
    await ufbtNewApp(
      appId,
      folders[0].with({ path: join(folders[0].path, appId) })
    );
  }
}
