import { spawnSync } from "node:child_process";
import fsp from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const releaseRoot = path.join(root, "release");
const stagingRoot = path.join(releaseRoot, "staging");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageName = packageJson.name;
const version =
  process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || packageJson.version || "dev";
const platform = process.platform === "win32" ? "windows-x64" : "linux-x64";
const artifactBase = `${packageName}-${version}-${platform}`;
const artifactDir = path.join(releaseRoot, artifactBase);

await fsp.rm(releaseRoot, { recursive: true, force: true });
await fsp.mkdir(stagingRoot, { recursive: true });
await fsp.mkdir(artifactDir, { recursive: true });

for (const entry of ["dist", "package.json", "package-lock.json", "README.md", "LICENSE"]) {
  const source = path.join(root, entry);
  const destination = path.join(stagingRoot, entry);
  await fsp.cp(source, destination, { recursive: true });
}

const install = spawnSync("npm", ["ci", "--omit=dev"], {
  cwd: stagingRoot,
  stdio: "inherit",
  shell: process.platform === "win32"
});

if (install.status !== 0) {
  process.exit(install.status ?? 1);
}

const binDir = path.join(stagingRoot, "bin");
await fsp.mkdir(binDir, { recursive: true });
await fsp.writeFile(
  path.join(binDir, "zeno"),
  "#!/usr/bin/env sh\nDIR=\"$(CDPATH= cd -- \"$(dirname -- \"$0\")/..\" && pwd)\"\nnode \"$DIR/dist/index.js\" \"$@\"\n",
  "utf8"
);
await fsp.writeFile(
  path.join(binDir, "zeno.cmd"),
  "@echo off\r\nset DIR=%~dp0..\r\nnode \"%DIR%\\dist\\index.js\" %*\r\n",
  "utf8"
);

if (process.platform !== "win32") {
  await fsp.chmod(path.join(binDir, "zeno"), 0o755);
}

await fsp.cp(stagingRoot, artifactDir, { recursive: true });

if (process.platform === "win32") {
  const zipName = `${artifactBase}.zip`;
  const zip = spawnSync(
    "powershell",
    [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${artifactDir}\\*' -DestinationPath '${path.join(releaseRoot, zipName)}' -Force`
    ],
    { stdio: "inherit" }
  );

  if (zip.status !== 0) {
    process.exit(zip.status ?? 1);
  }
} else {
  const tarName = `${artifactBase}.tar.gz`;
  const tar = spawnSync("tar", ["-czf", path.join(releaseRoot, tarName), "-C", releaseRoot, artifactBase], {
    stdio: "inherit"
  });

  if (tar.status !== 0) {
    process.exit(tar.status ?? 1);
  }
}

await fsp.rm(stagingRoot, { recursive: true, force: true });

console.log(`Release package created for ${platform} in ${releaseRoot}`);
