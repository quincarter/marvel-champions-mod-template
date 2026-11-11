#!/usr/bin/env node
// Checks the pack is ready to submit to the Mod Store registry and prints the registry file with the real tag and commit.
//
//   node .agents/skills/submit-pack/scripts/submit.mjs [--skip-build]
//
// Checks: pack.json has no TODO and a valid version; CREDITS.md and PERMISSION.md are filled in; the git tree is clean;
// the tag v<version> exists locally and on origin and points at HEAD's history; `mc-pack build` succeeds (zip sha256 is
// printed). Then prints packs/<id>.yaml. Exit 0 when ready, 1 with a list of what is missing.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readJson, run } from "../../../../scripts/lib/pack-cards.mjs";

const git = (...a) => {
  try {
    return execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};
const problems = [];
const bad = (m) => problems.push(m);

const pack = existsSync("pack.json") ? readJson("pack.json") : (bad("pack.json is missing"), {});
const packText = existsSync("pack.json") ? readFileSync("pack.json", "utf8") : "";
if (/TODO/.test(packText)) bad("pack.json still has a TODO: run `npm run describe`, fill the answers with its flags, then --write");
if (!/^\d+\.\d+\.\d+/.test(pack.version ?? "")) bad(`pack.json version "${pack.version}" is not semver`);
for (const file of ["CREDITS.md", "PERMISSION.md"]) {
  if (!existsSync(file)) bad(`${file} is missing`);
  else if (/TODO/.test(readFileSync(file, "utf8"))) bad(`${file} still has a TODO line`);
}
if (existsSync("PERMISSION.md") && /not recorded as granted|Status: (not granted|denied|waiting)/i.test(readFileSync("PERMISSION.md", "utf8"))) bad("PERMISSION.md does not say permission is granted: packs without permission are never approved");
if (!pack.permission?.by) bad("pack.json has no permission block (who allows the store to distribute it)");
if (!pack.permission?.evidence) bad("pack.json permission.evidence is empty: the registry review asks for a link or a quoted message");
if (!pack.permission?.date) bad("pack.json permission.date is empty (YYYY-MM-DD)");

if (git("status", "--porcelain")) bad("the git tree has uncommitted changes: commit them, then tag");
const remote = git("remote", "get-url", "origin").replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "");
if (!remote) bad("no git remote `origin`: push the pack to GitHub first");
const tag = `v${pack.version}`;
const commit = git("rev-parse", `${tag}^{commit}`);
if (!commit) bad(`tag ${tag} does not exist: \`git tag ${tag} && git push origin ${tag}\` (the tag must match pack.json's version)`);
else {
  const onRemote = git("ls-remote", "--tags", "origin", tag);
  if (!onRemote) bad(`tag ${tag} is not on origin: \`git push origin ${tag}\``);
  if (git("rev-parse", "HEAD") !== commit) bad(`HEAD is not the commit ${tag} points at (${commit.slice(0, 8)}): you have changes after the tag; bump the version and tag again`);
}

let zipLine = "";
if (!process.argv.includes("--skip-build")) {
  const built = run("mc-pack", ["build", ".", "--out", "build"]);
  if (built.status !== 0) bad(`mc-pack build failed:\n${(built.stderr || built.stdout).trim().split("\n").slice(0, 8).join("\n")}`);
  else zipLine = built.stdout.split("\n").find((l) => l.includes("sha256")) ?? "";
}

if (problems.length > 0) {
  console.log(`Not ready to submit (${problems.length}):`);
  for (const p of problems) console.log(`- ${p}`);
  process.exit(1);
}
const yaml = [
  `id: ${pack.id}`,
  `repo: ${remote}`,
  `tag: ${tag}`,
  `commit: ${commit}`,
  `creator: ${pack.authors?.[0] ?? ""}`,
  "permission:",
  `  by: ${pack.permission.by}`,
  `  evidence: ${pack.permission.evidence}`,
  `  date: ${pack.permission.date}`,
  `tags: [${pack.kind}]`,
].join("\n");
console.log(`Ready. ${zipLine.trim()}\n\nAdd this as packs/${pack.id}.yaml in https://github.com/quincarter/marvel-champions-mods and open a pull request:\n\n${yaml}\n`);
