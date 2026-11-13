#!/usr/bin/env node
// Checks the pack is ready to submit to the Mod Store registry and writes the registry file with the real tag and
// commit.
//
//   node .agents/skills/submit-pack/scripts/submit.mjs [--skip-build] [--summary "One line"] [--tags hero,justice]
//
// Checks, in order:
//   - pack.json has no TODO and a semver version; CREDITS.md and PERMISSION.md exist with no TODO;
//   - pack.json's permission is granted, with by, date, evidence, scope and languages, and the languages cover every
//     language in languages.available (the same rule as `mc-pack validate --publish`); there is no DRAFT file;
//   - the git tree is clean, `origin` is a GitHub repo, the tag v<version> exists locally and on origin and points at
//     HEAD;
//   - when the GitHub CLI (`gh`) is installed and signed in (`gh auth status`): the tag's release carries <id>-<version>.zip;
//   - `mc-pack build` succeeds (its zip sha256 is printed).
// Then prints packs/<id>.yaml and writes it to submission/<id>.yaml (git-ignored). Exit 0 when ready, 1 with a list of
// what is missing. It never opens a pull request: that waits for the creator's go-ahead (SKILL.md).
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readJson, run } from "../../../../scripts/lib/pack-cards.mjs";

const argv = process.argv.slice(2);
const option = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] !== undefined && !argv[i + 1].startsWith("--") ? argv[i + 1] : undefined;
};
const exec = (cmd, ...a) => {
  try {
    return execFileSync(cmd, a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return undefined;
  }
};
const git = (...a) => exec("git", ...a) ?? "";
const problems = [];
const notes = [];
const bad = (m) => problems.push(m);

// A YAML scalar: plain when that is safe, otherwise double-quoted (a JSON string is a valid YAML scalar).
const yamlScalar = (v) => {
  const s = String(v);
  const plain = /^[A-Za-z0-9_][A-Za-z0-9 _.,/@()+-]*$/.test(s) && !s.endsWith(" ");
  return plain && !/^(true|false|yes|no|on|off|null|~)$/i.test(s) ? s : JSON.stringify(s);
};

// ---- pack.json, credits and permission -----------------------------------------------------------------------------
const pack = existsSync("pack.json") ? readJson("pack.json") : (bad("pack.json is missing"), {});
const packText = existsSync("pack.json") ? readFileSync("pack.json", "utf8") : "";
if (pack.id === "sample-hero") bad('the pack id is still sample-hero: run `npm run init-pack -- --id <your-id> --name "<Name>" --author "<You>"`');
if (/TODO/.test(packText)) bad("pack.json still has a TODO: run `npm run describe`, fill the answers with its flags, then --write");
if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(pack.version ?? "")) bad(`pack.json version "${pack.version}" is not semver (1.0.0)`);
for (const file of ["CREDITS.md", "PERMISSION.md"]) {
  if (!existsSync(file)) bad(`${file} is missing`);
  else if (/TODO/.test(readFileSync(file, "utf8"))) bad(`${file} still has a TODO line`);
}
if (existsSync("DRAFT")) bad("there is a DRAFT file: the pack is marked not ready to publish; delete it when it is");

const permission = pack.permission ?? {};
if (!pack.permission) bad("pack.json has no permission block: record who allows the store to distribute the pack (npm run describe -- --permission-by ...)");
else {
  if (permission.status !== "granted")
    bad(`pack.json permission.status is ${permission.status ?? "missing"}, not granted${permission.note ? ` (${permission.note})` : ""}: packs without granted permission are never approved`);
  for (const field of ["by", "date", "evidence", "scope"]) {
    if (typeof permission[field] !== "string" || permission[field].trim() === "") bad(`pack.json permission.${field} is empty`);
  }
  if (permission.date && !/^\d{4}-\d{2}-\d{2}$/.test(permission.date)) bad(`pack.json permission.date "${permission.date}" is not YYYY-MM-DD`);
  const covered = Array.isArray(permission.languages) ? permission.languages : [];
  if (!Array.isArray(permission.languages)) bad("pack.json permission.languages is missing: list the languages the permission covers");
  const uncovered = (pack.languages?.available ?? []).filter((l) => !covered.includes(l));
  if (uncovered.length > 0) bad(`pack.json permission.languages does not cover ${uncovered.join(", ")}: a translation needs the creator's permission too`);
}

// ---- git: clean tree, origin, tag -----------------------------------------------------------------------------------
if (git("status", "--porcelain")) bad("the git tree has uncommitted changes: commit them, then tag");
const remote = git("remote", "get-url", "origin")
  .replace(/^git@github\.com:/, "https://github.com/")
  .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
  .replace(/\.git$/, "");
if (!remote) bad("no git remote `origin`: push the pack to GitHub first");
else if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(remote)) bad(`origin is ${remote}: the registry needs a https://github.com/<owner>/<repo> repo`);
const tag = `v${pack.version}`;
const commit = git("rev-parse", `${tag}^{commit}`);
if (!commit) bad(`tag ${tag} does not exist: \`git tag ${tag} && git push origin ${tag}\` (the tag must match pack.json's version)`);
else {
  const onRemote = git("ls-remote", "--tags", "origin", `refs/tags/${tag}`, `refs/tags/${tag}^{}`).split("\n").filter(Boolean);
  const remoteSha = onRemote.at(-1)?.split(/\s+/)[0];
  if (onRemote.length === 0) bad(`tag ${tag} is not on origin: \`git push origin ${tag}\``);
  else if (remoteSha !== commit) bad(`tag ${tag} on origin points at ${remoteSha?.slice(0, 8)}, but locally at ${commit.slice(0, 8)}: never move a released tag; bump the version and tag again`);
  if (git("rev-parse", "HEAD") !== commit) bad(`HEAD is not the commit ${tag} points at (${commit.slice(0, 8)}): check out the tag, or bump the version and tag again`);
}

// ---- the release on GitHub (optional: needs gh) --------------------------------------------------------------------
const zipName = `${pack.id}-${pack.version}.zip`;
if (commit && remote && exec("gh", "auth", "status") !== undefined) {
  const assets = exec("gh", "release", "view", tag, "--repo", remote.replace("https://github.com/", ""), "--json", "assets", "--jq", ".assets[].name");
  if (assets === undefined) bad(`no GitHub release ${tag} yet: wait for the Pack workflow's release job on the tag (Actions tab), or fix its failure`);
  else if (!assets.split("\n").includes(zipName)) bad(`the ${tag} release has no ${zipName}: the registry downloads it and compares it with its own build`);
} else if (commit && remote) notes.push(`gh is not installed or not signed in: check by hand that the ${tag} release on GitHub has ${zipName}`);

// ---- build ---------------------------------------------------------------------------------------------------------
let zipLine = "";
if (!argv.includes("--skip-build")) {
  const built = run("mc-pack", ["build", ".", "--out", "build"]);
  if (built.status !== 0) bad(`mc-pack build failed:\n${(built.stderr || built.stdout).trim().split("\n").slice(0, 8).join("\n")}`);
  else zipLine = built.stdout.split("\n").find((l) => l.includes("sha256")) ?? "";
}

if (problems.length > 0) {
  console.log(`Not ready to submit (${problems.length}):`);
  for (const p of problems) console.log(`- ${p}`);
  for (const n of notes) console.log(`note: ${n}`);
  process.exit(1);
}

const tags = (option("tags") ?? pack.kind ?? "hero").split(",").map((t) => t.trim()).filter(Boolean);
const summary = option("summary");
const yaml = [
  `id: ${pack.id}`,
  `repo: ${remote}`,
  `tag: ${tag}`,
  `commit: ${commit}`,
  `creator: ${yamlScalar(pack.authors?.[0] ?? "")}`,
  "permission:",
  `  by: ${yamlScalar(permission.by)}`,
  `  evidence: ${yamlScalar(permission.evidence)}`,
  `  date: ${permission.date}`,
  `tags: [${tags.join(", ")}]`,
  ...(summary ? [`summary: ${yamlScalar(summary)}`] : []),
  "",
].join("\n");
mkdirSync("submission", { recursive: true });
writeFileSync(`submission/${pack.id}.yaml`, yaml);
console.log(`Ready. ${zipLine.trim()}`);
for (const n of notes) console.log(`note: ${n}`);
console.log(
  `\nWrote submission/${pack.id}.yaml. Add it as packs/${pack.id}.yaml in https://github.com/quincarter/marvel-champions-mods and open a pull request (SUBMITTING.md, step 9):\n\n${yaml}`,
);
