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

/** Map the runner OS to a canonical release platform string. */
function resolvePlatform() {
  switch (process.platform) {
    case "win32":
      return "windows-x64";
    case "darwin":
      return "macos-x64";
    case "linux":
    default:
      return "linux-x64";
  }
}

const platform = resolvePlatform();
const artifactBase = `${packageName}-${version}-${platform}`;
const artifactDir = path.join(releaseRoot, artifactBase);

/** Pack an npm-installable tarball named <pkg>.tgz (used by the release URL). */
function packNpmTarball(target) {
  const result = spawnSync("npm", ["pack", "--pack-destination", target], {
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  const produced = path.join(
    target,
    `${packageName}-${version.replace(/^v/, "")}.tgz`
  );
  const renamed = path.join(target, `${packageName}.tgz`);
  fs.renameSync(produced, renamed);
  return renamed;
}

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

// The npm-installable tarball is platform-independent; pack it from the root
// so the release can be installed with:
//   npm install -g https://github.com/vibecoder880/ZenoCLI/releases/latest/download/zeno-cli.tgz
// Only the linux job produces it to avoid duplicate assets across the matrix.
if (platform === "linux-x64") {
  packNpmTarball(releaseRoot);
}

await fsp.rm(stagingRoot, { recursive: true, force: true });

console.log(`Release package created for ${platform} in ${releaseRoot}`);
console.log(`npm tarball: ${path.join(releaseRoot, `${packageName}.tgz`)}`);
