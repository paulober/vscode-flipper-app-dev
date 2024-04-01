import axios from "axios";
import {
  type ReadStream,
  createWriteStream,
  mkdirSync,
  unlinkSync,
  rmdirSync,
  readdirSync,
  statSync,
  renameSync,
} from "fs";
import AdmZip from "adm-zip";
import { join } from "path";
import { tmpdir } from "os";
import { chmod } from "fs/promises";

const HTTP_STATUS_OK = 200;
const HTTP_STATUS_NOT_MODIFIED = 304;
const EXT_USER_AGENT = "Flipper App Dev VS Code Extension";
const GITHUB_API_BASE_URL = "https://api.github.com";

export interface GHRelease {
  id: number;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  tag_name: string;
  name: string;
  prerelease: boolean;
}

interface GHBranch {
  commit: {
    sha: string;
  };
}

export type GHReleaseResponse = {
  assetsUrl: string;
  assets: GHReleaseAssetData[];
};

export type GHReleaseAssetData = {
  name: string;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  browser_download_url: string;
};

/**
 * Fetches the latest release of a GitHub repository.
 *
 * @param owner The owner of the repository.
 * @param repo The name of the repository.
 * @returns The latest release of the repository.
 */
export async function getLatestRelease(
  owner: string,
  repo: string
): Promise<GHRelease | null> {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/releases/latest`
    );
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const release = response.data as GHRelease;

    if (!release.prerelease) {
      return release;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching latest release:", error);

    return null;
  }
}

/**
 * Fetches the latest pre-release of a GitHub repository.
 *
 * @param owner The owner of the repository.
 * @param repo The name of the repository.
 * @returns The latest pre-release of the repository.
 */
export async function getLatestPreRelease(
  owner: string,
  repo: string
): Promise<GHRelease | null> {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/releases`
    );
    const releases = response.data as GHRelease[];

    // Filter out pre-releases
    const latestPreRelease = releases.find(release => release.prerelease);

    // If there are no pre-releases, return null
    if (!latestPreRelease) {
      return null;
    }

    return latestPreRelease;
  } catch (error) {
    console.error("Error fetching latest pre-release:", error);

    return null;
  }
}

/**
 * Fetches the latest commit hash of a branch in a GitHub repository.
 *
 * @param owner The owner of the repository.
 * @param repo The name of the repository.
 * @param branch The name of the branch.
 * @returns The latest commit hash of the branch in the repository.
 */
export async function getLatestCommitHash(
  owner: string,
  repo: string,
  branch: string
): Promise<string | null> {
  try {
    const response = await axios.get(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/branches/${branch}`
    );

    return (response.data as GHBranch).commit.sha;
  } catch (error) {
    console.error("Error fetching latest commit hash:", error);

    return null;
  }
}

export async function downloadAndExtractRelease(
  owner: string,
  repo: string,
  releaseTag: string,
  extractDir: string
): Promise<boolean> {
  try {
    // Create a temporary directory to store the zip file
    /*const tempDir = join(__dirname, "temp");*/
    const tempDir = join(tmpdir(), "flipper-vscode");
    mkdirSync(tempDir, { recursive: true });

    // Create a writable stream to write the response to a temporary zip file
    const tempZipFile = join(tempDir, "temp.zip");
    const writerStream = createWriteStream(tempZipFile);

    // Stream the response directly into the zip file
    const response = await axios.get<ReadStream>(
      `${GITHUB_API_BASE_URL}/repos/${owner}/${repo}/zipball/${releaseTag}`,
      {
        responseType: "stream",
      }
    );
    response.data.pipe(writerStream);

    // Wait for the stream to finish writing to the file
    await new Promise((resolve, reject) => {
      writerStream.on("finish", resolve);
      writerStream.on("error", reject);
    });
    writerStream.close();

    // Extract the zip file
    const zip = new AdmZip(tempZipFile);
    zip.extractAllTo(extractDir, true);

    // Clean up the temporary directory and file
    unlinkSync(tempZipFile);
    rmdirSync(tempDir, { recursive: true });

    // move contents of extracted folder to the target folder
    const targetDirContents = readdirSync(extractDir);
    const subfolderPath =
      targetDirContents.length === 1
        ? join(extractDir, targetDirContents[0])
        : "";
    if (
      targetDirContents.length === 1 &&
      statSync(subfolderPath).isDirectory()
    ) {
      readdirSync(subfolderPath).forEach(item => {
        const itemPath = join(subfolderPath, item);
        const newItemPath = join(extractDir, item);

        // Use fs.renameSync to move the item
        renameSync(itemPath, newItemPath);
      });
      rmdirSync(subfolderPath);
    }

    // chmod +x extractDir/fbt if linux or macOS
    if (process.platform !== "win32") {
      const fbtPath = join(extractDir, "fbt");
      try {
        const mode = statSync(fbtPath).mode | 0o111;
        await chmod(fbtPath, mode);
      } catch (error) {
        console.error("Error making fbt executable:", error);
      }
    }

    console.log(`Release ${releaseTag} extracted to ${extractDir}`);

    return true;
  } catch (error) {
    throw new Error(
      `Error downloading and extracting release: ${
        error instanceof Error ? error.message : (error as string)
      }`
    );

    return false;
  }
}
