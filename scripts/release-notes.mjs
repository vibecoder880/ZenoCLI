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
 * The current changelog has no explicit category labels, so we infer them
 * from the leading tokens of each bullet.
 */
function classifyBullet(bullet) {
  const lower = bullet.toLowerCase();

  if (/\b(fix|fixed|fixes|bug|bugfix|correct|patch)/.test(lower)) {
    return "Fixes";
  }
  if (/\b(docs?|documentation|readme|guide|guidebook)\b/.test(lower)) {
    return "Docs";
  }
  if (/\b(feat|feature|adds?|new|support|implements|introduces|phase \d)/.test(lower)) {
    return "Features";
  }
  return "Other";
}

// Extract the changelog body for this version, preserving any "Phase N" title.
const rawBody = match[1].trim();
const phaseMatch = rawBody.match(/^###\s+([^\n]+)/);
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