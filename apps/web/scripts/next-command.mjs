import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..");

const command = process.argv[2] ?? "dev";
const extraArgs = process.argv.slice(3);

const distDirByCommand = {
  dev: ".next-dev",
  build: ".next-build",
  start: ".next-build",
};

const distDir = distDirByCommand[command] ?? ".next-dev";

function cleanGeneratedFolder(folder) {
  try {
    rmSync(join(webRoot, folder), { recursive: true, force: true, maxRetries: 3, retryDelay: 250 });
  } catch (error) {
    console.warn(
      `[next-command] Could not fully remove ${folder}. Continuing because Next will use ${distDir}.`,
    );
    if (process.env.DEBUG_NEXT_CLEAN === "1") {
      console.warn(error);
    }
  }
}

if (command === "clean") {
  [".next", ".next-dev", ".next-build", ".next-runtime", "next-runtime"].forEach(cleanGeneratedFolder);
  process.exit(0);
}

if (command === "dev" || command === "build") {
  cleanGeneratedFolder(distDir);
}

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const child = spawn(npmCommand, ["exec", "next", "--", command, ...extraArgs], {
  cwd: webRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    NEXT_DIST_DIR: distDir,
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error);
  process.exit(1);
});

