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

/**
 * Classify a changelog bullet into Features / Fixes / Docs / Other.
 * The changelog uses plain prose bullets (no explicit category labels), so the
 * category is inferred from keywords. Fixes and docs win; anything that adds,
 * hardens, or enhances behavior (including security work) lands in Features.
 */
function classifyBullet(bullet) {
  const lower = bullet.toLowerCase();

  if (/\b(fix|fixed|fixes|bug|bugfix|correct|patch|harden|hardened|regression)\b/.test(lower)) {
    return "Fixes";
  }
  if (/\b(docs?|documentation|readme|readme.md|guide|guidebook|changelog)\b/.test(lower)) {
    return "Docs";
  }
  if (
    /\b(feat|feature|adds?|add|new|support|implements|introduces|introduce|enable|enabled|improve|improved|capabilit|ability|allow|allows|auto|automate|refresh|pkce|oauth|token|encrypt|decrypt|security|sandbox|plugin|hook|mcp|provider|command|flag|pipeline|release)\b/.test(
      lower
    )
  ) {
    return "Features";
  }
  return "Other";
}

// Extract the changelog body for this version. A "Phase N" heading becomes the
// release's banner title; plain sub-headings (Features/Security/Notes) are
// changelog organization and are NOT treated as the phase title.
const rawBody = match[1].trim();
const phaseMatch = rawBody.match(/^###\s+(Phase\s+\d[^\n]*)/i);
const phaseTitle = phaseMatch ? phaseMatch[1].trim() : undefined;

// Collect bullet lines (lines starting with "- " or "* ") and drop the title/heading.
const bullets = rawBody
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.startsWith("- ") || line.startsWith("* "))
  .map((line) => line.replace(/^[-*]\s+/, ""));

const buckets = {
  Features: [],
  Fixes: [],
  Docs: [],
  Other: [],
};

for (const bullet of bullets) {
  buckets[classifyBullet(bullet)].push(bullet);
}

let body = `# ZenoCLI ${version}\n\n`;

if (phaseTitle) {
  body += `### ${phaseTitle}\n\n`;
}

for (const category of ["Features", "Fixes", "Docs", "Other"]) {
  const items = buckets[category];
  if (items.length === 0) {
    continue;
  }
  body += `## ${category}\n\n`;
  for (const item of items) {
    body += `- ${item}\n`;
  }
  body += "\n";
}

fs.writeFileSync(outputPath, body, "utf8");
console.log(`Release notes written to ${outputPath}`);