import { exec } from "child_process";
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { promisify } from "util";
import { type Terminal, ThemeIcon, type Uri, window, workspace } from "vscode";
import { getShellRoot } from "./fsHelper.mjs";
import { EXTENSION_NAME } from "../constants.mjs";
import { writeFile } from "fs/promises";

const execAsync = promisify(exec);

export async function installUfbt(): Promise<boolean> {
  const { stderr } = await execAsync(
    process.platform === "win32"
      ? "py -m pip install -U ufbt"
      : "python3 -m pip install -U ufbt"
  );

  if (stderr) {
    console.error(stderr);

    void window.showErrorMessage(
      "An error occurred while installing ufbt. " +
        "Please check the output for more information: " +
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
      "An error occurred while creating a new app. " +
        "Please check the output for more information: " +
        stderr
    );

    return;
  }

  // add paulober.flipper-app-dev to the recommended extensions in folder/.vscode/extensions.json
  const extensionsPath = join(folder.fsPath, ".vscode", "extensions.json");
  const extensions = existsSync(extensionsPath)
    ? (JSON.parse(
        readFileSync(extensionsPath, "utf8").replaceAll(/^\s*\/\/.*$/gm, "")
      ) as {
        recommendations: string[];
      })
    : { recommendations: [] };
  extensions.recommendations = [
    ...(extensions.recommendations ?? []),
    `paulober.${EXTENSION_NAME}`,
  ];
  await writeFile(extensionsPath, JSON.stringify(extensions, null, 4));

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

export function ufbtLaunch(): void {
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
    name: "Launch Flipper Application Package",
    isTransient: true,
    iconPath: new ThemeIcon("rocket"),
  });

  // Show the terminal
  ufbtBuildTerminal.show();
}

export function ufbtCli(): void {
  if (ufbtConsoleTerminal) {
    ufbtConsoleTerminal.dispose();
  }

  ufbtConsoleTerminal = window.createTerminal({
    cwd: workspace.workspaceFolders?.[0].uri.fsPath ?? homedir(),
    shellPath: "ufbt",
    shellArgs: ["cli"],
    name: "Flipper Serial Console",
    isTransient: true,
    iconPath: new ThemeIcon("game"),
  });

  // Show the terminal
  ufbtConsoleTerminal.show();
}

export function ufbtBuild(): void {
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
    iconPath: new ThemeIcon("wrench"),
  });

  // Show the terminal
  ufbtBuildTerminal.show();
}

export enum UfbtSDKBranch {
  release = "release",
  rc = "rc",
  dev = "dev",
}

export function ufbtSwitchSDK(branch: UfbtSDKBranch): void {
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
  const { stderr } = await execAsync("ufbt clean", {
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

export function ufbtGetSelectedChannel(): string | null {
  const filePath = join(homedir(), ".ufbt", "current", "ufbt_state.json");

  try {
    // Check if file exists
    if (existsSync(filePath)) {
      // Read the file content
      const fileContent = readFileSync(filePath, "utf8");
      // Parse JSON content
      const jsonData = JSON.parse(fileContent) as { channel: string } | null;
      // Check if 'channel' property exists in the JSON data
      if (jsonData && jsonData.channel) {
        return jsonData.channel;
      } else {
        console.error(
          "Channel property not found in the ufbt state JSON data."
        );

        return null;
      }
    } else {
      return null;
    }
  } catch (err) {
    console.error("Error reading ufbt state:", err);

    return null;
  }
}
