import { dirname } from "path";
import { join as joinPosix } from "path/posix";
import { fileURLToPath } from "url";

export function getShellRoot(): string {
  return joinPosix(
    dirname(fileURLToPath(import.meta.url)).replaceAll("\\", "/"),
    "..",
    "shell"
  );
}
