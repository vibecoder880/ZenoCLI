import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const changelogPath = path.join(root, "CHANGELOG.md");
const outputPath = path.join(root, "release-notes.md");
const tag = process.env.RELEASE_VERSION || process.env.GITHUB_REF_NAME || "";
const version = tag.startsWith("v") ? tag.slice(1) : tag;

if (!version) {
  throw new Error("RELEASE_VERSION or GITHUB_REF_NAME is required to build release notes.");
}

const changelog = fs.readFileSync(changelogPath, "utf8");
const sectionPattern = new RegExp(`## ${version.replaceAll(".", "\\.")}[^\\n]*\\n([\\s\\S]*?)(\\n## |$)`);
const match = changelog.match(sectionPattern);

if (!match) {
  throw new Error(`Could not find changelog section for version ${version}.`);
}

const body = `# ZenoCLI ${version}\n\n${match[1].trim()}\n`;
fs.writeFileSync(outputPath, body, "utf8");
console.log(`Release notes written to ${outputPath}`);
