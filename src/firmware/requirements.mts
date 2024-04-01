import { window } from "vscode";
import which from "which";

export interface Requirements {
  python: boolean;
  pip: boolean;
}

export async function checkRequirements(): Promise<Requirements> {
  const req = {} as Requirements;
  const response = await which(
    process.platform === "win32" ? "py" : "python3",
    { nothrow: true }
  );
  req.python = response !== null;

  const response2 = await which("pip3", { nothrow: true });
  req.pip = response !== null || process.platform === "win32";

  return req;
}

export async function showRequirementsNotMetErrors(
  req: Requirements
): Promise<boolean> {
  let result = false;

  if (!req.python) {
    result = true;
    await window.showErrorMessage(
      "Python3 is not installed. Please install install and restart VSCode."
    );
  }

  if (!req.pip) {
    result = true;
    await window.showErrorMessage(
      "Pip3 is not installed. Please install install and restart VSCode."
    );
  }

  return result;
}
