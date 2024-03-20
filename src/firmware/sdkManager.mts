import * as https from "https";
import { constants as fsConstants, mkdir, readdir } from "fs/promises";
import { exec } from "child_process";
import { access } from "fs";
import { rimraf } from "rimraf";
import { join as joinPosix } from "path/posix";
import { commands } from "vscode";

const GITHUB_REST_FLIPPER_DEV_URL =
  "https://api.github.com/repos/flipperdevices" +
  "/flipperzero-firmware/commits/dev";
const GITHUB_CLONE_FLIPPER_URL =
  "https://github.com//flipperdevices/flipperzero-firmware.git";

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
    await mkdir(process.env.HOME + "/.flipperzero", { recursive: true });
  }

  /**
   * Returns the SHA1 of the latest commit in the dev branch of the Flipper Zero firmware.
   *
   * @returns The SHA1 of the latest commit in the dev branch of the Flipper Zero firmware.
   */
  public static async getLatestDevVersion(): Promise<string> {
    try {
      const response = await fetchData(GITHUB_REST_FLIPPER_DEV_URL);
      const parsedResponse = JSON.parse(response) as { sha: string };

      if (parsedResponse.sha) {
        return parsedResponse.sha;
      } else {
        throw new Error('No "sha" key found in the response.');
      }
    } catch (error) {
      return "";
    }
  }

  /**
   * Installs the development SDK of the Flipper Zero firmware.
   *
   * @param sha1 The SHA1 of the commit to install.
   * @returns A promise that resolves when the installation is complete
   * and rejects if an error occurs.
   */
  public static async installDevSDK(sha1: string): Promise<void> {
    const folderPath = `${process.env.HOME}/.flipperzero/${sha1}`;

    // check if folder is already present
    if (await folderExists(folderPath)) {
      return;
    }

    const cloneCommand =
      `git clone ${GITHUB_CLONE_FLIPPER_URL} ` +
      `--branch dev --single-branch ` +
      folderPath +
      ` && cd ${folderPath} && git checkout ${sha1} && cd -`;

    return new Promise((resolve, reject) => {
      exec(cloneCommand, error => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Deletes the development SDK of the Flipper Zero firmware.
   * (uses rimraf)
   *
   * @param sha1 The SHA1 of the commit to delete.
   * @returns A promise that resolves when the deletion is complete
   * and rejects if an error occurs.
   */
  public static async deleteDevSDK(sha1: string): Promise<void> {
    const folderPath = `${process.env.HOME}/.flipperzero/${sha1}`;

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
    const folderPath = `${process.env.HOME}/.flipperzero`;

    if (!(await folderExists(folderPath))) {
      return [];
    }

    const items = await readdir(folderPath, { withFileTypes: true });

    return items.filter(item => item.isDirectory()).map(item => item.name);
  }

  /**
   * Creates a new app for the Flipper Zero firmware.
   *
   * @param sdk SHA1 of the commit (dev branch) to create the new app for.
   */
  public static async createNewApp(sdk: string, name: string): Promise<void> {
    const folderPath = joinPosix(
      process.env.HOME ?? "~",
      ".flipperzero",
      sdk,
      "applications_user",
      name
    );

    await mkdir(folderPath, { recursive: true });

    // open in vscode
    await commands.executeCommand("vscode.openFolder", folderPath);
  }
}
