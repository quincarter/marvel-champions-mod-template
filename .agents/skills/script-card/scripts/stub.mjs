#!/usr/bin/env node
// Lists the abilities that have no script yet, each with its card, the printed text split into its abilities, and the
// builder the timing word suggests, so the assistant starts from the card text and a likely shape, not a blank file.
//
//   node .agents/skills/script-card/scripts/stub.mjs [--card <code>] [--write]
//
// --card limits the list to one card. --write adds a TODO comment block per unscripted ability to abilities/index.ts
// (comments only, never code: an unfinished script must not look finished). Rerunning does not duplicate them.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { abilityIndex, clip, readCards, scriptedIds } from "../../../../scripts/lib/pack-cards.mjs";

const argv = process.argv.slice(2);
const only = argv.includes("--card") ? argv[argv.indexOf("--card") + 1] : undefined;
const write = argv.includes("--write");

// Printed timing words -> the builder and the event wording that goes with it.
const SHAPES = [
  [/^Forced Interrupt\b/i, "forcedInterrupt(when.<event>, ...effects)"],
  [/^Forced Response\b/i, "forcedResponse(after.<event>, ...effects)"],
  [/^Forced Action\b/i, "forcedAction(...effects)"],
  [/^Hero Interrupt\b/i, "heroInterrupt(when.<event>, ...effects)"],
  [/^Alter-Ego Interrupt\b/i, "alterEgoInterrupt(when.<event>, ...effects)"],
  [/^Interrupt\b/i, "interrupt(when.<event>, ...effects)"],
  [/^Hero Response\b/i, "heroResponse(after.<event>, ...effects)"],
  [/^Alter-Ego Response\b/i, "alterEgoResponse(after.<event>, ...effects)"],
  [/^Response\b/i, "response(after.<event>, ...effects)"],
  [/^Hero Action\b/i, "heroAction({ ... }, ...effects)"],
  [/^Alter-Ego Action\b/i, "alterEgoAction({ ... }, ...effects)"],
  [/^First Player Action\b/i, "firstPlayerAction({ ... }, ...effects)"],
  [/^Action\b/i, "action({ ... }, ...effects)"],
  [/^Hero Resource\b/i, "heroResource({ <icons> }, { cost, ... })"],
  [/^Resource\b/i, "resource({ <icons> }, { cost, ... })"],
  [/^When Revealed\b/i, "whenRevealed(...effects)"],
  [/^When Defeated\b/i, "whenDefeated(...effects)"],
  [/^(\[star\]\s*)?Boost\b/i, "boost(...effects)"],
  [/^Setup\b/i, "setup(...effects)"],
  [/^Preparation\b/i, "preparation(...effects)"],
];

function describe(line) {
  const text = line.replace(/^[^A-Za-z[]+/, "");
  // Every printed timing word in the line (a line can hold several: "Villainous. When Defeated: ...").
  const found = [];
  for (const [re, shape] of SHAPES) {
    const word = new RegExp(re.source.replace(/^\^/, "\\b").replace(/\\b$/, "") + "(?=[^:]{0,30}:)", "gi");
    const m = word.exec(text);
    if (m) found.push([m.index, m[0].length, shape]);
  }
  // Drop a shorter word contained in a longer one ("Interrupt" inside "Forced Interrupt").
  const kept = found.filter(([i, l], a) => !found.some(([j, k], b) => b !== a && j <= i && j + k >= i + l && k > l));
  const shape = kept.sort((a, b) => a[0] - b[0]).map((f) => f[2]).join("  +  ") || undefined;
  const hints = [];
  const label = /\((attack|thwart|defense)\)/i.exec(text)?.[1];
  if (label) hints.push(`label: "${label.toLowerCase()}"`);
  if (/limit once per round/i.test(text)) hints.push("limit: oncePerRound");
  else if (/limit once per phase/i.test(text)) hints.push("limit: oncePerPhase");
  if (/→/.test(text)) hints.push("a cost before the arrow -> { cost: ... }");
  if (/\bwould\b/i.test(text)) hints.push('"would" wording -> { would: true } / instead(...)');
  if (/\bsurge\b/i.test(text)) hints.push("surge: keyword = data, `this card gains surge` = surge()");
  return { text, shape: shape ?? "constant(...) or a keyword (data) if there is no timing word", hints };
}

const cards = readCards();
const index = abilityIndex(cards);
const done = scriptedIds();
let todo = [...index.entries()].filter(([id]) => !done.has(id));
if (only) todo = todo.filter(([, info]) => info.card === only);
if (todo.length === 0) {
  console.log(only ? `No unscripted abilities for ${only}.` : "No unscripted abilities: every ability a card lists has a script.");
  process.exit(0);
}
console.log(`${todo.length} unscripted ability(ies):`);
const byCard = new Map();
for (const [id, info] of todo) byCard.set(`${info.card}|${info.where}`, [...(byCard.get(`${info.card}|${info.where}`) ?? []), id]);
for (const [key, ids] of byCard) {
  const info = index.get(ids[0]);
  console.log(`\n${info.card} "${info.name}" (${info.type}, ${info.where})`);
  console.log(`  ids to script: ${ids.join(", ")}`);
  const lines = info.text.split("\n").map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const d = describe(line);
    console.log(`  text: ${clip(d.text, 240)}\n    shape: ${d.shape}${d.hints.length ? `\n    hints: ${d.hints.join("; ")}` : ""}`);
  }
}
console.log("\nNext: for each ability run the find-precedent skill with the card's wording, read the best script, write yours with a citing comment.");

if (write) {
  const path = "abilities/index.ts";
  if (!existsSync(path)) {
    console.error("no abilities/index.ts to write into");
    process.exit(1);
  }
  let source = readFileSync(path, "utf8");
  const blocks = [];
  for (const [id, info] of todo) {
    if (source.includes(`TODO(script-card): ${id}`)) continue;
    blocks.push(`  // TODO(script-card): ${id}\n  // ${info.card} "${info.name}" (${info.where}): ${clip(info.text, 200)}`);
  }
  if (blocks.length > 0) {
    const close = source.lastIndexOf("\n});");
    if (close < 0) {
      console.error('could not find the closing "});" of the default export; add the TODO comments by hand');
      process.exit(1);
    }
    source = `${source.slice(0, close)}\n\n${blocks.join("\n\n")}${source.slice(close)}`;
    writeFileSync(path, source);
    console.log(`wrote ${blocks.length} TODO comment(s) to ${path}`);
  }
}
