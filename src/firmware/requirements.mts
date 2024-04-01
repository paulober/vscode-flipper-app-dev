import { window } from "vscode";
import which from "which";

export interface Requirements {
  git: boolean;
  python: boolean;
}

export async function checkRequirements(): Promise<Requirements> {
  const req = {} as Requirements;
  const response = await which("git", { nothrow: true });
  req.git = response !== null;
  const response2 = await which(
    process.platform === "win32" ? "py" : "python3",
    { nothrow: true }
  );
  req.python = response2 !== null;

  return req;
}

export async function showRequirementsNotMetErrors(
  req: Requirements
): Promise<boolean> {
  let result = false;

  if (!req.git) {
    result = true;
    await window.showErrorMessage(
      "Git is not installed. Please install it and try again."
    );
  }

  if (!req.python) {
    result = true;
    await window.showErrorMessage(
      "Python3 is not installed. Please install it and try again."
    );
  }

  return result;
}
