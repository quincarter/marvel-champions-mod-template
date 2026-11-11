#!/usr/bin/env node
// Imports a MarvelCDB-shaped community pack folder into this repo, then prints the compact list of abilities still to
// script (id, card, printed text), so the assistant only has to script those.
//
//   node .agents/skills/import-pack/scripts/import.mjs <src-folder> [--id <pack-id>] [--dry]
//
// Runs `mc-pack import-marvelcdb <src> --out . [--id <pack-id>]` (a dry run with --dry), then `mc-pack validate .
// --allow-unscripted`. Exit 0: imported and only unscripted abilities remain. Exit 1: a real problem. Exit 2: usage.
import { clip, parseValidate, readCards, abilityIndex, run, unscriptedId } from "../../../../scripts/lib/pack-cards.mjs";

const args = process.argv.slice(2);
const src = args.find((a) => !a.startsWith("--") && args[args.indexOf(a) - 1] !== "--id");
const idAt = args.indexOf("--id");
const id = idAt >= 0 ? args[idAt + 1] : undefined;
const dry = args.includes("--dry");
if (!src) {
  console.error("usage: import.mjs <src-folder> [--id <pack-id>] [--dry]");
  process.exit(2);
}

const importArgs = ["import-marvelcdb", src, ...(dry ? [] : ["--out", "."]), ...(id ? ["--id", id] : [])];
const imported = run("mc-pack", importArgs);
const text = `${imported.stdout}${imported.stderr}`.trim();
// The importer's own report is long; show its header lines and its notes only.
const lines = text.split(/\r?\n/);
console.log(lines.filter((l) => !/^ {2}\S+: ability "/.test(l)).slice(0, 40).join("\n"));
if (imported.status !== 0) {
  console.error("\nimport failed: read the message above (a missing mod.json, an unusable pack id, a real problem in the cards).");
  process.exit(1);
}
if (dry) process.exit(0);

const validated = run("mc-pack", ["validate", ".", "--allow-unscripted"]);
const { defects, unscripted, summary } = parseValidate(`${validated.stdout}\n${validated.stderr}`);
console.log(`\n${summary}`);
if (defects.length > 0) {
  console.log(`\n${defects.length} problem(s) to fix before scripting (see docs/validation-errors.md):`);
  for (const d of defects) console.log(`  ${d.path}: ${d.message}`);
}
const index = abilityIndex(readCards());
console.log(`\n${unscripted.length} ability script(s) to write:`);
for (const issue of unscripted) {
  const abilityId = unscriptedId(issue);
  const info = abilityId ? index.get(abilityId) : undefined;
  console.log(`- ${abilityId}\n    card ${info?.card} "${info?.name}" (${info?.type}, ${info?.where})\n    text: ${clip(info?.text ?? "", 300)}`);
}
console.log("\nNext: script each ability (script-card skill), then run validate-and-fix.");
process.exit(defects.length > 0 ? 1 : 0);
