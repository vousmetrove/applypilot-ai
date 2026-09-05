import { access, readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const requiredFiles = [
  "README.md",
  "LICENSE",
  "CONTRIBUTING.md",
  "SECURITY.md",
  "PRIVACY.md",
  ".gitignore",
  ".openai/hosting.example.json",
  "extension/manifest.json",
];

for (const file of requiredFiles) await access(file);

const releaseFiles = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  { encoding: "utf8" },
)
  .split("\0")
  .filter(Boolean)
  .filter((file) => !/\.(zip|png|jpg|jpeg|gif|ico|woff2?)$/i.test(file));

const forbidden = [
  {
    label: "personal email",
    pattern: new RegExp(["meiqi011216", "gmail\\.com"].join("@"), "i"),
  },
  {
    label: "live Sites project id",
    pattern: new RegExp(["appg", "prj_"].join("") + "[a-z0-9]+", "i"),
  },
  {
    label: "GitHub personal access token",
    pattern: new RegExp(["gh", "[pousr]_"].join("") + "[A-Za-z0-9]{30,}"),
  },
  {
    label: "AWS access key",
    pattern: new RegExp(["AK", "IA"].join("") + "[A-Z0-9]{16}"),
  },
  {
    label: "OpenAI-style API key",
    pattern: new RegExp(["s", "k-"].join("") + "[A-Za-z0-9_-]{20,}"),
  },
  { label: "private key", pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ },
];

const findings = [];
for (const file of releaseFiles) {
  const text = await readFile(file, "utf8").catch(() => "");
  for (const rule of forbidden) {
    if (rule.pattern.test(text)) findings.push(`${file}: ${rule.label}`);
  }
}

if (findings.length) {
  console.error("Public release check failed:\n" + findings.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Public release check passed (${releaseFiles.length} text files scanned).`);
