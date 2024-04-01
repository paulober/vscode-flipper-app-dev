import {
  type ExtensionContext,
  window,
  StatusBarAlignment,
  workspace,
} from "vscode";
import { EXTENSION_NAME } from "../constants.mjs";
import BuildFapCommand from "../commands/buildFap.mjs";

export async function setupStatusbar({
  subscriptions,
}: ExtensionContext): Promise<void> {
  const buildStatusBarItem = window.createStatusBarItem(
    StatusBarAlignment.Left,
    1
  );
  const launchStatusBarItem = window.createStatusBarItem(
    StatusBarAlignment.Left,
    2
  );
  const openSerialStatusBarItem = window.createStatusBarItem(
    StatusBarAlignment.Left,
    3
  );
  buildStatusBarItem.text = "$(package) Build FAP";
  buildStatusBarItem.tooltip = "Build Flipper Application Package";
  buildStatusBarItem.command = `${EXTENSION_NAME}.${BuildFapCommand.id}`;

  launchStatusBarItem.text = "$(plug) Launch FAP";
  launchStatusBarItem.tooltip = "Launch Flipper Application Package on Flipper";
  launchStatusBarItem.command = `${EXTENSION_NAME}.launchFap`;

  openSerialStatusBarItem.text = "$(console) Flipper Serial Console";
  openSerialStatusBarItem.tooltip = "Open Flipper Serial Console";
  openSerialStatusBarItem.command = `${EXTENSION_NAME}.openSerial`;

  if (
    (await workspace.findFiles("**/application.fam", undefined, 1)).length > 0
  ) {
    buildStatusBarItem.show();
    launchStatusBarItem.show();
  }
  openSerialStatusBarItem.show();

  subscriptions.push(buildStatusBarItem);
  subscriptions.push(launchStatusBarItem);
  subscriptions.push(openSerialStatusBarItem);
}
