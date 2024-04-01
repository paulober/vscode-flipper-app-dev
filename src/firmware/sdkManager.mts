import * as https from "https";
import {
  chmod,
  constants as fsConstants,
  mkdir,
  readdir,
  writeFile,
} from "fs/promises";
import { exec } from "child_process";
import {
  access,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "fs";
import { rimraf } from "rimraf";
import { join as joinPosix } from "path/posix";
import { ProgressLocation, Uri, window, workspace } from "vscode";
import {
  type GHRelease,
  downloadAndExtractRelease,
} from "../helper/githubAPI.mjs";
import { getTemplatesRoot } from "../helper/fsHelper.mjs";
import { EXTENSION_NAME, SDKS_FOLDER_NAME } from "../constants.mjs";
import { homedir } from "os";
import { join } from "path";

async function fetchData(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      headers: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "User-Agent": "Visual Studio Code Flipper Zero Extension",
      },
    };

    const req = https.get(url, options, res => {
      let data = "";

      res.on("data", chunk => {
        data += chunk;
      });

      res.on("end", () => {
        resolve(data);
      });
    });

    req.on("error", error => {
      reject(error);
    });

    req.end();
  });
}

async function folderExists(path: string): Promise<boolean> {
  return new Promise(resolve => {
    access(path, fsConstants.F_OK, err => {
      resolve(!err);
    });
  });
}

/**
 * Used to manage (download, updated, delete, ...) the firmware SDKs.
 *
 * Currently only supports the experimental SDKs of the OFW.
 */
export default class FirmwareSDKManager {
  public static async createDevWorkspace(): Promise<void> {
    // create ~/.flipperzero
    await mkdir(join(homedir(), SDKS_FOLDER_NAME), { recursive: true });
  }

  /**
   * Installs the development SDK of the Flipper Zero firmware.
   *
   * @param sha1 The SHA1 of the commit to install.
   * @returns A promise that resolves when the installation is complete
   * and rejects if an error occurs.
   */
  public static async installSDKFromGit(
    owner: string,
    repoName: string,
    branch: string,
    sha1?: string,
    sdk?: GHRelease
  ): Promise<boolean> {
    if (sdk === undefined && sha1 === undefined) {
      return false;
    }

    const folderPath = joinPosix(
      homedir().replaceAll("\\", "/"),
      SDKS_FOLDER_NAME,
      sha1 ?? sdk?.tag_name ?? ""
    );

    // check if folder is already present
    if (await folderExists(folderPath)) {
      return true;
    }

    const cloneCommand =
      "git -c advice.detachedHead=false clone --recursive " +
      `https://github.com/${owner}/${repoName}.git ` +
      `--branch ${sdk?.tag_name ?? branch} --single-branch "` +
      folderPath +
      `" && cd "${folderPath}" && ${
        (sha1 ? `git checkout ${sha1} && ` : "") + "cd -"
      }`;

    let result = await window.withProgress<boolean>(
      {
        location: ProgressLocation.Notification,
        title: "Cloning SDK...",
      },
      async () =>
        new Promise<boolean>(resolve => {
          exec(cloneCommand, error => {
            if (error) {
              // TODO: log
              resolve(false);
            } else {
              resolve(true);
            }
          });
        })
    );

    if (!result) {
      await rimraf(folderPath);

      void window.showErrorMessage(
        `Failed to clone SDK ${sha1 ?? sdk?.tag_name} from GitHub.`
      );

      return false;
    }

    // chmod +x extractDir/fbt if linux or macOS
    if (process.platform !== "win32") {
      const fbtPath = join(folderPath, "fbt");
      try {
        const mode = statSync(fbtPath).mode | 0o111;
        await chmod(fbtPath, mode);
      } catch (error) {
        console.error("Error making sdk/fbt executable:", error);
      }
    }

    result = await window.withProgress<boolean>(
      {
        location: ProgressLocation.Notification,
        title: "Installing Toolchain...",
      },
      async () => {
        // Define the command to run
        const fbtCommand =
          `cd "${folderPath}" && ` + "./fbt vscode_dist LANG_SERVER=cpptools";

        // Create a Promise to execute the command
        return new Promise<boolean>(resolve => {
          // Execute the command asynchronously
          exec(fbtCommand, error => {
            if (error) {
              resolve(false);
            } else {
              resolve(true);
            }
          });
        });
      }
    );

    if (result && sdk !== undefined) {
      const info = {
        id: sdk.id,
        name: sdk.name,
        prerelease: sdk.prerelease,
      };

      try {
        // write to file
        writeFileSync(
          joinPosix(folderPath, "info.json"),
          JSON.stringify(info),
          "utf8"
        );
      } catch {
        // delete folder
        await rimraf(folderPath);

        void window.showErrorMessage(
          `Failed to install toolchain for SDK ${sha1 ?? sdk.tag_name}.`
        );

        return false;
      }
    } else {
      await rimraf(folderPath);

      void window.showErrorMessage(
        `Failed to install toolchain for SDK ${sha1 ?? sdk?.tag_name}.`
      );
    }

    return result;
  }

  /**
   * Install the SDK from the GitHub release.
   *
   * @param sdk
   * @returns
   */
  public static async installSDK(
    repoOwner: string,
    repoName: string,
    sdk: GHRelease
  ): Promise<boolean> {
    if (existsSync(join(homedir(), SDKS_FOLDER_NAME, sdk.tag_name))) {
      return true;
    }

    mkdirSync(join(homedir(), SDKS_FOLDER_NAME), { recursive: true });
    let result = false;
    const sdkPath = joinPosix(
      homedir().replaceAll("\\", "/"),
      SDKS_FOLDER_NAME,
      sdk.tag_name
    );

    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `Downloading SDK ${sdk.name}...`,
      },
      async () => {
        result = await downloadAndExtractRelease(
          repoOwner,
          repoName,
          sdk.tag_name,
          sdkPath
        );
      }
    );

    // save info
    if (result) {
      await window.withProgress(
        {
          location: ProgressLocation.Notification,
          title: "Installing Toolchain...",
        },
        async () => {
          // Define the command to run
          const fbtCommand =
            `cd "${sdkPath}" && ` + "./fbt vscode_dist LANG_SERVER=cpptools";

          // Create a Promise to execute the command
          return new Promise(resolve => {
            result = true;

            // Execute the command asynchronously
            exec(fbtCommand, error => {
              if (error) {
                console.error(error);
                result = false;
              }

              // Resolve the Promise
              resolve(null);
            });
          });
        }
      );

      if (result) {
        const info = {
          id: sdk.id,
          name: sdk.name,
          prerelease: sdk.prerelease,
        };

        try {
          // write to file
          writeFileSync(
            join(homedir(), SDKS_FOLDER_NAME, sdk.tag_name, "info.json"),
            JSON.stringify(info),
            "utf8"
          );
        } catch {
          // delete folder
          await rimraf(join(homedir(), SDKS_FOLDER_NAME, sdk.tag_name));

          return false;
        }
      }
    }

    return result;
  }

  public static getSDKInfo(releaseTag: string): GHRelease | null {
    const infoPath = join(homedir(), SDKS_FOLDER_NAME, releaseTag, "info.json");

    if (!existsSync(infoPath)) {
      return null;
    }

    try {
      const fileContent = readFileSync(infoPath, "utf8");

      const info = JSON.parse(fileContent) as {
        id: number;
        name: string;
        prerelease: boolean;
      };

      return {
        id: info.id,
        name: info.name,
        prerelease: info.prerelease,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        tag_name: releaseTag,
      };
    } catch {
      return null;
    }
  }

  /**
   * Deletes a SDK.
   * (uses rimraf)
   *
   * @param sha1 The SHA1 of the commit to delete.
   * @returns A promise that resolves when the deletion is complete
   * and rejects if an error occurs.
   */
  public static async deleteSDK(sha1OrTag: string): Promise<void> {
    const folderPath = join(homedir(), SDKS_FOLDER_NAME, sha1OrTag);

    const result = await rimraf(folderPath);
    if (result) {
      // TODO: use logger
      console.error(result);
    }
  }

  /**
   * Lists all installed SDKs.
   *
   * @returns A promise that resolves with an array of SHA1s of the installed SDKs.
   */
  public static async listInstalledSDKs(): Promise<string[]> {
    const folderPath = join(homedir(), SDKS_FOLDER_NAME);

    if (!(await folderExists(folderPath))) {
      return [];
    }

    const items = await readdir(folderPath, { withFileTypes: true });

    return items.filter(item => item.isDirectory()).map(item => item.name);
  }

  /**
   * Creates a new app for the Flipper Zero firmware and adds it to the workspace.
   *
   * @param sdk SHA1 of the commit (dev branch) or release tag (prerelease and stable release)
   * to create the new app for/with.
   */
  public static async createNewApp(
    sdk: string,
    name: string,
    appId: string
  ): Promise<void> {
    const folderPath = joinPosix(
      homedir(),
      SDKS_FOLDER_NAME,
      sdk,
      "applications_user",
      name
    );

    await mkdir(folderPath, { recursive: true });

    const tempaltesRoot = getTemplatesRoot();

    // save memory by save after read

    const appC = readFileSync(`${tempaltesRoot}/app.c`, "utf8");
    const appCReplaced = appC
      .replaceAll(/<app_id>/g, appId)
      .replaceAll(/<app_name>/g, name);

    await writeFile(`${folderPath}/${appId}.c`, appCReplaced, "utf8");

    const appFam = readFileSync(`${tempaltesRoot}/application.fam`, "utf8");
    const appFamReplaced = appFam
      .replaceAll(/<app_id>/g, appId)
      .replaceAll(/<app_name>/g, name);

    await writeFile(`${folderPath}/application.fam`, appFamReplaced, "utf8");

    // create .vscode folder in folderPath
    await mkdir(`${folderPath}/.vscode`, { recursive: true });

    // write c_cpp_properties.json
    const cCppProperties = {
      configurations: [
        {
          name: "Flipper",
          cStandard: "gnu23",
          cppStandard: "c++20",
          includePath: [
            "${workspaceFolder}/**",
            "${workspaceFolder}/../../applications/services/**",
            "${workspaceFolder}/../../furi/**",
            "${workspaceFolder}/../../**",
            "${workspaceFolder}/../../targets/f7/inc/**",
            "${workspaceFolder}/../../targets/f7/furi_hal/**",
            "${workspaceFolder}/../../targets/furi_hal_include/**",
            "${workspaceFolder}/../../toolchain/current/arm-none-eabi/**",
          ],
          intelliSenseMode: "linux-gcc-arm",
          /*compileCommands:
            // eslint-disable-next-line max-len
            "${workspaceFolder}/../../build/f7-firmware-D/compile_commands.json",*/
          // eslint-disable-next-line max-len
          compilerPath: `\${userHome}/${SDKS_FOLDER_NAME}/${sdk}/toolchain/current/bin/arm-none-eabi-gcc`,
        },
      ],
      version: 4,
    };

    await writeFile(
      join(folderPath, ".vscode", "c_cpp_properties.json"),
      JSON.stringify(cCppProperties, null, 4),
      "utf8"
    );

    // create extensions.json
    const extensions = {
      recommendations: [
        "paulober." + EXTENSION_NAME,
        "ms-python.black-formatter",
        "ms-vscode.cpptools",
        "amiralizadeh9480.cpp-helper",
        "marus25.cortex-debug",
        "zxh404.vscode-proto3",
        "augustocdias.tasks-shell-input",
        "rioj7.command-variable",
      ],
      unwantedRecommendations: [
        "llvm-vs-code-extensions.vscode-clangd",
        "twxs.cmake",
        "ms-vscode.cmake-tools",
      ],
    };

    await writeFile(
      join(folderPath, ".vscode", "extensions.json"),
      JSON.stringify(extensions, null, 4),
      "utf8"
    );

    // copy tasks.json and launch.json from templates to folderpath/.vscode
    await writeFile(
      join(folderPath, ".vscode", "tasks.json"),
      readFileSync(`${tempaltesRoot}/tasks.json`, "utf8"),
      "utf8"
    );
    await writeFile(
      join(folderPath, ".vscode", "launch.json"),
      readFileSync(`${tempaltesRoot}/launch.json`, "utf8"),
      "utf8"
    );

    // add to workspace
    workspace.updateWorkspaceFolders(
      workspace.workspaceFolders?.length ?? 0,
      null,
      { uri: Uri.file(folderPath), name: name }
    );
  }
}
