import type { Uri } from "vscode";

export enum SDKSource {
  ofw = "https://github.com/flipperdevices/flipperzero-firmware.git",
  xfw = "https://github.com/Flipper-XFW/Xtreme-Firmware.git",
}

export enum SDKType {
  stable = 0,
  beta = 1,
  dev = 2,
}

export default interface SDK {
  source: SDKSource;
  type: SDKType;
  version: string;
  url: Uri;
}
