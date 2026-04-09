import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

export function runGitContext(opts: {
  cwd: string;
  base: string;
  outFile: string;
  publicCopy?: string;
}): void {
  const { cwd, base, outFile, publicCopy } = opts;
  let changedFiles: string[] = [];
  try {
    const out = execSync(`git diff --name-only ${base}...HEAD`, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    changedFiles = out
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  } catch {
    try {
      const out = execSync(`git diff --name-only ${base}`, {
        cwd,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      changedFiles = out
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
    } catch {
      changedFiles = [];
    }
  }

  const payload = {
    base,
    changedFiles,
    generatedAt: new Date().toISOString(),
  };

  const abs = resolve(cwd, outFile);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(payload, null, 2), "utf-8");
  if (publicCopy) {
    const absPub = resolve(cwd, publicCopy);
    mkdirSync(dirname(absPub), { recursive: true });
    writeFileSync(absPub, JSON.stringify(payload, null, 2), "utf-8");
  }
}
