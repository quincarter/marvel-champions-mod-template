#!/usr/bin/env node
// Finds base-game cards whose printed text matches some words, and the script that implements each, so the assistant
// can read one script instead of searching the game's source.
//
//   node .agents/skills/find-precedent/scripts/find.mjs "deal damage to each hero" [--type minion] [--limit 8]
//   node .agents/skills/find-precedent/scripts/find.mjs --builder forcedInterrupt [--limit 8]
//   node .agents/skills/find-precedent/scripts/find.mjs --refresh      rebuild the cached indexes
//
// The game's source is read from a clone: --repo <path>, $MC_GAME_REPO, or .cache/game-repo, which is made on first use
// (a sparse, shallow clone of just packages/cards/src and packages/content/src/data; needs git and network).
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, relative } from "node:path";

const GAME = "https://github.com/quincarter/marvel-champions-digital-game.git";
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? (argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[i + 1]) : undefined;
};
const valueFlags = new Set(["repo", "type", "limit", "builder"]);
const positional = argv.filter((a, i) => !a.startsWith("--") && !valueFlags.has(argv[i - 1]?.replace(/^--/, "")));
const limit = Number(flag("limit")) || 8;

function ensureRepo() {
  const given = flag("repo") ?? process.env.MC_GAME_REPO;
  const repo = typeof given === "string" ? given : join(".cache", "game-repo");
  if (existsSync(join(repo, "packages", "cards", "src"))) return repo;
  if (typeof given === "string") {
    console.error(`${repo} is not a clone of the game repo (no packages/cards/src).`);
    process.exit(2);
  }
  console.error(`First use: cloning the game's source into ${repo} (shallow, sparse) ...`);
  mkdirSync(".cache", { recursive: true });
  const steps = [
    ["clone", "--depth", "1", "--filter=blob:none", "--sparse", GAME, repo],
    ["-C", repo, "sparse-checkout", "set", "packages/cards/src", "packages/content/src/data"],
  ];
  for (const step of steps) {
    const r = spawnSync("git", step, { stdio: ["ignore", "ignore", "inherit"] });
    if (r.status !== 0) {
      console.error(`git ${step[0]} failed. Clone ${GAME} yourself and pass --repo <path>, or search it on GitHub.`);
      process.exit(2);
    }
  }
  return repo;
}

const repo = ensureRepo();
const cacheFile = join(".cache", "precedent-index.json");

const walk = (dir, out = []) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
};
const lit = (s) => JSON.parse(s);

function buildIndex() {
  const cards = [];
  const dataDir = join(repo, "packages", "content", "src", "data");
  for (const set of readdirSync(dataDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
    const file = join(dataDir, set.name, "cards.ts");
    if (!existsSync(file)) continue;
    const text = readFileSync(file, "utf8");
    const starts = [...text.matchAll(/id:\s*cardId\("([^"]+)"\)/g)];
    starts.forEach((m, i) => {
      const body = text.slice(m.index, starts[i + 1]?.index ?? text.length);
      const name = /\bname:\s*("(?:[^"\\]|\\.)*")/.exec(body);
      const type = /\btype:\s*"([a-z_]+)"/.exec(body);
      const texts = [...body.matchAll(/\bprinted:\s*("(?:[^"\\]|\\.)*")/g)].map((t) => lit(t[1])).filter(Boolean);
      const abilities = [...body.matchAll(/abilityId\("([^"]+)"\)/g)].map((a) => a[1]);
      cards.push({ id: m[1], set: set.name, name: name ? lit(name[1]) : "", type: type?.[1] ?? "", text: texts.join(" / "), abilities });
    });
  }
  // Script keys: `"<code>.<slug>": builder(...)` in non-test source files under packages/cards/src.
  const scripts = {};
  const builders = [];
  for (const file of walk(join(repo, "packages", "cards", "src")).filter((f) => f.endsWith(".ts") && !/\.(test|testing)\.ts$/.test(f))) {
    const rel = relative(repo, file).replaceAll("\\", "/");
    const lines = readFileSync(file, "utf8").split("\n");
    let key;
    lines.forEach((line, i) => {
      const k = /^\s*"([0-9]{5}[a-z]?\.[a-z0-9-]+)"\s*:/.exec(line);
      if (k) {
        key = k[1];
        scripts[key] = `${rel}:${i + 1}`;
      }
      if (!rel.includes("/dsl/")) builders.push([rel, i + 1, key ?? "", line.trim()]);
    });
  }
  return { built: new Date().toISOString(), cards, scripts, builders };
}

let index;
if (!flag("refresh") && existsSync(cacheFile) && statSync(cacheFile).mtimeMs > statSync(join(repo, "packages")).mtimeMs) {
  index = JSON.parse(readFileSync(cacheFile, "utf8"));
} else {
  console.error("Indexing the game's cards and scripts (once) ...");
  index = buildIndex();
  mkdirSync(".cache", { recursive: true });
  writeFileSync(cacheFile, JSON.stringify(index));
}
if (flag("refresh") && positional.length === 0 && !flag("builder")) {
  console.log(`indexed ${index.cards.length} cards, ${Object.keys(index.scripts).length} scripts`);
  process.exit(0);
}

const builder = flag("builder");
if (typeof builder === "string") {
  const hits = index.builders.filter(([, , , line]) => line.includes(`${builder}(`) && !line.startsWith("//") && !line.startsWith("*"));
  console.log(`${hits.length} use(s) of ${builder}(...); first ${Math.min(limit, hits.length)}:`);
  for (const [file, line, key, text] of hits.slice(0, limit)) console.log(`- ${file}:${line}  ${key}\n    ${text.slice(0, 160)}`);
  process.exit(hits.length ? 0 : 1);
}

const query = positional.join(" ").toLowerCase();
if (!query) {
  console.error('usage: find.mjs "words from the card text" [--type event] [--limit 8]  |  --builder <name>');
  process.exit(2);
}
const STOP = new Set(["the", "and", "that", "this", "from", "with", "your", "you", "each", "for", "may", "its", "any", "all", "are", "was", "then"]);
const tokens = [...new Set(query.match(/[a-z0-9]+/g) ?? [])].filter((t) => t.length > 2 && !STOP.has(t));
const words = query.match(/[a-z0-9]+/g) ?? [];
const bigrams = words.slice(1).map((w, i) => `${words[i]} ${w}`);
const type = flag("type");
const scored = [];
for (const card of index.cards) {
  if (typeof type === "string" && card.type !== type) continue;
  const hay = `${card.text} ${card.name}`.toLowerCase();
  const score = tokens.filter((t) => hay.includes(t)).length;
  if (score >= Math.max(1, Math.ceil(tokens.length * 0.6)) && card.text) scored.push({ card, score, bigram: bigrams.filter((b) => hay.replace(/[^a-z0-9]+/g, " ").includes(b)).length, phrase: hay.includes(query) });
}
scored.sort((a, b) => Number(b.phrase) - Number(a.phrase) || b.score + b.bigram - (a.score + a.bigram) || a.card.text.length - b.card.text.length);
console.log(`${scored.length} card(s) match [${tokens.join(", ")}]; best ${Math.min(limit, scored.length)}:`);
for (const { card, score } of scored.slice(0, limit)) {
  const where = card.abilities.map((a) => (index.scripts[a] ? `${a} -> ${index.scripts[a]}` : `${a} (no script found: data, a reprint or an engine rule)`));
  console.log(`- ${card.id} ${card.name} [${card.type}, ${card.set}] score ${score}/${tokens.length}`);
  console.log(`    text: ${card.text.replace(/\s+/g, " ").slice(0, 260)}`);
  for (const w of where.slice(0, 4)) console.log(`    script: ${w}`);
}
if (scored.length === 0) console.log("No card has these words. Try fewer or different words (the card's verbs and nouns), or --builder <name>.");
