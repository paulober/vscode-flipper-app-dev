import { window } from "vscode";
import which from "which";

export interface Requirements {
  git: boolean;
}

export async function checkRequirements(): Promise<Requirements> {
  const req = {} as Requirements;
  const response = await which("git", { nothrow: true });
  req.git = response !== null;

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

  return result;
}
