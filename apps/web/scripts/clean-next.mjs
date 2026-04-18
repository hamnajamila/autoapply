import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const target = path.resolve(".next");

function removeWithFs() {
  fs.rmSync(target, { recursive: true, force: true });
}

function removeWithPowerShell() {
  const result = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `if (Test-Path '${target}') { Remove-Item -LiteralPath '${target}' -Recurse -Force }`
    ],
    { stdio: "inherit" }
  );

  if (result.status !== 0) {
    console.warn(`Skipping .next cleanup because PowerShell removal failed (exit ${result.status ?? "unknown"}).`);
  }
}

try {
  removeWithFs();
} catch (error) {
  if (process.platform !== "win32") {
    throw error;
  }

  try {
    removeWithPowerShell();
  } catch {
    console.warn("Skipping .next cleanup and continuing build.");
  }
}
