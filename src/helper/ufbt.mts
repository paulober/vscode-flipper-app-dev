import { exec } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { promisify } from "util";
import { Terminal, Uri, window, workspace } from "vscode";
import { getShellRoot } from "./fsHelper.mjs";

const execAsync = promisify(exec);

export async function installUfbt(): Promise<boolean> {
  const { stdout, stderr } = await execAsync(
    process.platform === "win32"
      ? "py -m pip install -U ufbt"
      : "python3 -m pip install -U ufbt"
  );

  if (stderr) {
    console.error(stderr);

    void window.showErrorMessage(
      "An error occurred while installing ufbt. Please check the output for more information: " +
        stderr
    );

    return false;
  }

  return true;
}

export async function ufbtNewApp(appId: string, folder: Uri): Promise<void> {
  const { stderr } = await execAsync(`ufbt vscode_dist create APPID=${appId}`, {
    cwd: folder.fsPath,
  });

  if (!existsSync(join(folder.fsPath, "application.fam"))) {
    console.error(stderr);

    void window.showErrorMessage(
      "An error occurred while creating a new app. Please check the output for more information: " +
        stderr
    );

    return;
  }

  void window.showInformationMessage("Created new app successfully.");

  workspace.updateWorkspaceFolders(
    workspace.workspaceFolders?.length ?? 0,
    null,
    {
      uri: folder,
      name: appId,
    }
  );
}

let ufbtBuildTerminal: Terminal | undefined;
let ufbtConsoleTerminal: Terminal | undefined;

export async function ufbtLaunch(): Promise<void> {
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    void window.showErrorMessage("No open flipper application folder found.");

    return;
  }

  // close console as we need the serial port
  if (ufbtConsoleTerminal) {
    ufbtConsoleTerminal.dispose();
    ufbtConsoleTerminal = undefined;
  }

  if (ufbtBuildTerminal) {
    ufbtBuildTerminal.dispose();
  }

  ufbtBuildTerminal = window.createTerminal({
    cwd: workspace.workspaceFolders?.[0].uri.fsPath ?? homedir(),
    shellPath: join(
      getShellRoot(),
      `shell.${process.platform === "win32" ? "cmd" : "sh"}`
    ),
    shellArgs: ["ufbt", "launch"],
    name: "Build/Launch Flipper Application Package",
    isTransient: true,
  });

  // Show the terminal
  ufbtBuildTerminal.show();
}

export async function ufbtCli(): Promise<void> {
  if (ufbtConsoleTerminal) {
    ufbtConsoleTerminal.dispose();
  }

  ufbtConsoleTerminal = window.createTerminal({
    cwd: homedir(),
    shellPath: "ufbt",
    shellArgs: ["cli"],
    name: "Flipper Serial Console",
    isTransient: true,
  });

  // Show the terminal
  ufbtConsoleTerminal.show();
}

export async function ufbtBuild(): Promise<void> {
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    void window.showErrorMessage("No open flipper application folder found.");

    return;
  }

  if (ufbtBuildTerminal) {
    ufbtBuildTerminal.dispose();
  }

  ufbtBuildTerminal = window.createTerminal({
    cwd: workspace.workspaceFolders?.[0].uri.fsPath ?? homedir(),
    shellPath: join(
      getShellRoot(),
      `shell.${process.platform === "win32" ? "cmd" : "sh"}`
    ),
    shellArgs: ["ufbt"],
    name: "Build Flipper Application Package",
    isTransient: true,
  });

  // Show the terminal
  ufbtBuildTerminal.show();
}

export enum UfbtSDKBranch {
  release = "release",
  rc = "rc",
  dev = "dev",
}

export async function ufbtSwitchSDK(branch: UfbtSDKBranch): Promise<void> {
  if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    void window.showErrorMessage("No open flipper application folder found.");

    return;
  }

  if (ufbtBuildTerminal) {
    ufbtBuildTerminal.dispose();
  }

  ufbtBuildTerminal = window.createTerminal({
    cwd: workspace.workspaceFolders?.[0].uri.fsPath ?? homedir(),
    shellPath: join(
      getShellRoot(),
      `shell.${process.platform === "win32" ? "cmd" : "sh"}`
    ),
    shellArgs: [
      "ufbt",
      "--no-check-certificate",
      "update",
      "-c",
      branch.toString(),
    ],
    name: "Switch Flipper SDK",
    isTransient: true,
  });

  // Show the terminal
  ufbtBuildTerminal.show();
}

export async function ufbtClean(): Promise<void> {
  const { stdout, stderr } = await execAsync("ufbt clean", {
    cwd: homedir(),
  });

  if (stderr) {
    console.error(stderr);

    void window.showErrorMessage(
      "An error occurred while cleaning ufbt: " + stderr
    );

    return;
  }

  void window.showInformationMessage("Cleaned successfully.");
}
