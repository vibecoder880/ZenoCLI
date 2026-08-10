import packageJson from "../../../package.json" with { type: "json" };

export function runVersionCommand(): void {
  console.log(`zeno-cli ${packageJson.version}`);
}
