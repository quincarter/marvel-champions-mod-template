#!/usr/bin/env node
// Runs the repo's describe helper (scripts/describe.mjs) and prints a compact summary: what it found, the files it
// would write, and the TODOs only the creator can answer. Extra arguments are passed through to the helper, so the
// same script also applies answers: `... --creator "Name" --permission-by "Name" --write`.
//
//   node .agents/skills/describe-pack/scripts/describe.mjs [helper flags]   (add --full to print the drafted files)
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const full = args.includes("--full");
const passed = args.filter((a) => a !== "--full");
const r = spawnSync(process.execPath, ["scripts/describe.mjs", "--json", ...passed], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
if (r.stderr) process.stderr.write(r.stderr);
let out;
try {
  out = JSON.parse(r.stdout);
} catch {
  console.error(r.stdout || "describe helper printed nothing");
  process.exit(r.status || 1);
}
const f = out.facts;
console.log(`cards: ${f.cards} ${JSON.stringify(f.byType)}`);
console.log(`heroes: ${f.identities.join(", ") || "-"}; decks: ${f.decks.join(", ") || "-"}; scenarios: ${f.scenarios.join(", ") || "-"}; encounter sets: ${f.encounterSets.join(", ") || "-"}; campaigns: ${f.campaigns.join(", ") || "-"}`);
console.log(`picture languages: ${f.pictureLanguages.join(", ") || "none"}; mod.json: ${f.modJson ?? "none"}`);
const pack = JSON.parse(out.files["pack.json"]);
console.log(`pack.json draft: id ${pack.id}, version ${pack.version}, kind ${pack.kind}, name "${pack.name}", authors ${JSON.stringify(pack.authors)}`);
console.log(`  description: ${pack.description}`);
if (full) for (const [path, text] of Object.entries(out.files)) console.log(`\n=== ${path} ===\n${text}`);
console.log(`\n${out.todos.length} TODO(s):`);
for (const t of out.todos) console.log(`- ${t}`);
console.log("\nAsk the creator for the facts above (never invent permission or evidence), rerun with the flags and --write.");
process.exit(r.status ?? 0);
