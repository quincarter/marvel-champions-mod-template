#!/usr/bin/env node
// Makes every AI tool find the same instructions, agents and skills.
//
// The canonical files are AGENTS.md, .agents/agents/*.md and .agents/skills/<name>/. Each tool looks somewhere else, so
// those places are symlinks to the canonical files:
//
//   CLAUDE.md                        -> AGENTS.md            (Claude Code)
//   GEMINI.md                        -> AGENTS.md            (Gemini CLI)
//   .github/copilot-instructions.md  -> ../AGENTS.md         (GitHub Copilot)
//   .claude/agents                   -> ../.agents/agents    (Claude Code subagents)
//   .claude/skills                   -> ../.agents/skills    (Claude Code skills)
//
// Codex, Cursor, Windsurf, opencode and others read AGENTS.md directly. Codex also reads .agents/skills, and its
// subagents are TOML files, so `.codex/agents/<name>.toml` is generated from each .agents/agents/<name>.md (a
// conversion, not a link: rerun this script after editing an agent).
//
//   npm run agents:link               create the links (copies where symlinks are not allowed), generate the TOML
//   npm run agents:link -- --index    also record the links as real symlinks in the git index (for the person who
//                                     commits them, on any OS: `git update-index --cacheinfo 120000,...`)
//   npm run agents:link -- --check    exit 1 if anything is missing or a copy is out of date (for CI)
//   npm run agents:link -- --only-generated   only (re)generate .codex/agents/*.toml, touch no links
//
// On Linux and macOS git checks the symlinks out and this script has nothing to do. On Windows without Developer Mode,
// git checks a symlink out as a small text file holding the target path; this script replaces it with a real symlink
// where it can and with a copy where it cannot (a copy is refreshed each time you run the script).
import {
  copyFileSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";

const LINKS = [
  { path: "CLAUDE.md", target: "AGENTS.md", dir: false },
  { path: "GEMINI.md", target: "AGENTS.md", dir: false },
  { path: ".github/copilot-instructions.md", target: "../AGENTS.md", dir: false },
  { path: ".claude/agents", target: "../.agents/agents", dir: true },
  { path: ".claude/skills", target: "../.agents/skills", dir: true },
];

const args = new Set(process.argv.slice(2));
const check = args.has("--check");
const index = args.has("--index");
const onlyGenerated = args.has("--only-generated");
let problems = 0;
const say = (m) => console.log(m);
const problem = (m) => {
  problems++;
  console.error(m);
};

const stat = (p) => {
  try {
    return lstatSync(p);
  } catch {
    return undefined;
  }
};
const sourceOf = ({ path, target }) => resolve(dirname(path), target);

/** Is `path` already a symlink to `target`, or a text stub / copy of it? */
function state(link) {
  const st = stat(link.path);
  if (!st) return "missing";
  if (st.isSymbolicLink()) return readlinkSync(link.path).replaceAll("\\", "/") === link.target ? "linked" : "wrong-link";
  const source = sourceOf(link);
  if (!link.dir && st.isFile()) {
    const text = readFileSync(link.path, "utf8");
    if (text.trim() === link.target) return "stub"; // git checked a symlink out as a text file
    return existsSync(source) && text === readFileSync(source, "utf8") ? "copy" : "stale-copy";
  }
  if (link.dir && st.isDirectory()) return sameTree(link.path, source) ? "copy" : "stale-copy";
  if (link.dir && st.isFile()) return "stub";
  return "stale-copy";
}

function sameTree(a, b) {
  if (!existsSync(a) || !existsSync(b)) return false;
  const names = (d) => readdirSync(d, { withFileTypes: true }).map((e) => e.name).sort();
  const na = names(a);
  if (na.join("/") !== names(b).join("/")) return false;
  for (const n of na) {
    const pa = join(a, n);
    const pb = join(b, n);
    if (lstatSync(pa).isDirectory()) {
      if (!sameTree(pa, pb)) return false;
    } else if (readFileSync(pa, "utf8") !== readFileSync(pb, "utf8")) return false;
  }
  return true;
}

function link(l) {
  const st = state(l);
  if (check) {
    if (st === "missing" || st === "wrong-link" || st === "stale-copy" || st === "stub") problem(`${l.path}: ${st}`);
    return;
  }
  if (st === "linked") return say(`ok      ${l.path} -> ${l.target}`);
  const source = sourceOf(l);
  if (!existsSync(source)) return problem(`${l.path}: cannot link, ${l.target} does not exist`);
  mkdirSync(dirname(l.path), { recursive: true });
  if (st !== "missing") rmSync(l.path, { recursive: true, force: true });
  try {
    symlinkSync(l.target, l.path, l.dir ? "dir" : "file");
    say(`linked  ${l.path} -> ${l.target}`);
  } catch (error) {
    // No permission to symlink (Windows without Developer Mode): copy, and refresh the copy on each run.
    if (l.dir) cpSync(source, l.path, { recursive: true });
    else copyFileSync(source, l.path);
    say(`copied  ${l.path} (symlinks are not allowed here: ${error.code ?? error.message}); rerun after editing ${l.target}`);
  }
}

// ---- Codex: .codex/agents/<name>.toml generated from .agents/agents/<name>.md ----------------------------------------
function parseAgent(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!m) return undefined;
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_-]+):\s*(.*)$/.exec(line);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2].trim() };
}
const tomlString = (s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function codexAgents() {
  const dir = ".agents/agents";
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".md")).sort()) {
    const agent = parseAgent(readFileSync(join(dir, file), "utf8"));
    if (!agent?.meta.name) {
      problem(`${dir}/${file}: needs frontmatter with a name`);
      continue;
    }
    const body = agent.body.includes("'''") ? tomlString(agent.body) : `'''\n${agent.body}\n'''`;
    const toml = `name = ${tomlString(agent.meta.name)}\ndescription = ${tomlString(agent.meta.description ?? "")}\ndeveloper_instructions = ${body}\n`;
    const out = `.codex/agents/${file.replace(/\.md$/, ".toml")}`;
    if (check) {
      if (!existsSync(out) || readFileSync(out, "utf8") !== toml) problem(`${out}: missing or out of date (run npm run agents:link)`);
      continue;
    }
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, toml);
    say(`wrote   ${out}`);
  }
}

// ---- git index: real symlink entries (mode 120000) --------------------------------------------------------------------
function stageSymlinks() {
  for (const l of LINKS) {
    try {
      const sha = execFileSync("git", ["hash-object", "-w", "--stdin"], { input: l.target, encoding: "utf8" }).trim();
      execFileSync("git", ["update-index", "--add", "--cacheinfo", `120000,${sha},${l.path}`]);
      say(`staged  ${l.path} as a symlink to ${l.target} (mode 120000)`);
    } catch (error) {
      problem(`${l.path}: could not stage the symlink: ${error.message}`);
    }
  }
}

if (!onlyGenerated) for (const l of LINKS) link(l);
codexAgents();
if (index && !check) stageSymlinks();
if (problems > 0) {
  console.error(`${problems} problem(s)`);
  process.exit(1);
}
