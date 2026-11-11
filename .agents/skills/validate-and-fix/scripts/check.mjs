#!/usr/bin/env node
// Runs the pack's three checks and prints one compact list of issues, each with a hint to the part of
// docs/validation-errors.md that explains it, instead of pages of raw output.
//
//   node .agents/skills/validate-and-fix/scripts/check.mjs [--no-test] [--games 1] [--json]
//
// Steps: `mc-pack validate .`, `tsc --noEmit`, `mc-pack test . --games <n>` (skipped with --no-test, and when validate
// or typecheck fails, since a broken pack is not played). Exit 0 when all pass (unscripted abilities count as a
// failure), 1 otherwise.
import { abilityIndex, clip, parseValidate, readCards, run, unscriptedId } from "../../../../scripts/lib/pack-cards.mjs";

const argv = process.argv.slice(2);
const json = argv.includes("--json");
const noTest = argv.includes("--no-test");
const games = argv.includes("--games") ? argv[argv.indexOf("--games") + 1] : "1";

const DOC = "docs/validation-errors.md";
const HINTS = [
  [/card code must start with|card code must be|card code is used/, `${DOC}#card-and-id-errors`],
  [/ability id|names a card number/, `${DOC}#card-and-id-errors`],
  [/is in neither the pack nor the base game/, `${DOC}#card-and-id-errors`],
  [/keyword|uses keyword|hinder/, `${DOC}#card-and-id-errors (keyword table: docs/card-json.md)`],
  [/missing |must be |needs |must have/, `${DOC}#card-and-id-errors (fields: docs/card-json.md)`],
  [/DSL feature/, `${DOC}#uses-dsl-feature--which-this-game-version-lacks`],
  [/encounter set|nemesis|scenario id|deck id|packCode/, `${DOC}#encounter-sets-decks-scenarios`],
  [/pack\.json|permission|languages|altArt|pictures|CREDITS|PERMISSION|listed|sha256|unsafe file/, `${DOC}#packjson-art-and-permission`],
  [/could not be checked/, `${DOC}#card-and-id-errors (wrong shape: compare with docs/card-json.md)`],
];
const hintFor = (message) => HINTS.find(([re]) => re.test(message))?.[1] ?? DOC;

const report = { steps: [] };
const step = (name, status, extra = {}) => report.steps.push({ name, status, ...extra });

// 1. validate
const validated = run("mc-pack", ["validate", "."]);
const { defects, unscripted, summary } = parseValidate(`${validated.stdout}\n${validated.stderr}`);
const index = abilityIndex(readCards());
const unscriptedList = unscripted.map((issue) => {
  const id = unscriptedId(issue);
  const info = id ? index.get(id) : undefined;
  return { id, card: info?.card, name: info?.name, text: clip(info?.text ?? "", 160) };
});
const loadFailure = defects.length === 0 && unscripted.length === 0 && validated.status !== 0;
step("validate", validated.status === 0 ? "ok" : "fail", {
  summary,
  problems: defects.map((d) => ({ ...d, hint: hintFor(d.message) })),
  unscripted: unscriptedList,
  ...(loadFailure ? { raw: clip(`${validated.stdout}\n${validated.stderr}`, 600) } : {}),
});

// 2. typecheck
const tsc = run("tsc", ["--noEmit"]);
const tsIssues = `${tsc.stdout}\n${tsc.stderr}`
  .split(/\r?\n/)
  .map((l) => /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/.exec(l))
  .filter(Boolean)
  .map((m) => ({ file: m[1], line: Number(m[2]), code: m[4], message: clip(m[5], 240) }));
step("typecheck", tsc.status === 0 ? "ok" : "fail", { issues: tsIssues, ...(tsc.status !== 0 && tsIssues.length === 0 ? { raw: clip(`${tsc.stdout}\n${tsc.stderr}`, 400) } : {}) });

// 3. test
if (noTest) step("test", "skipped", { reason: "--no-test" });
else if (validated.status !== 0 || tsc.status !== 0) step("test", "skipped", { reason: "validate or typecheck failed" });
else {
  const tested = run("mc-pack", ["test", ".", "--games", games]);
  const out = `${tested.stdout}\n${tested.stderr}`.split(/\r?\n/).filter(Boolean);
  step("test", tested.status === 0 ? "ok" : "fail", {
    failures: out.filter((l) => /fail|error|stuck|illegal/i.test(l)).slice(0, 12).map((l) => clip(l, 300)),
    last: out.slice(-2),
  });
}

const ok = report.steps.every((s) => s.status !== "fail");
if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  for (const s of report.steps) {
    console.log(`${s.name}: ${s.status.toUpperCase()}${s.reason ? ` (${s.reason})` : ""}${s.summary ? ` - ${s.summary}` : ""}`);
    for (const p of s.problems ?? []) console.log(`  [problem] ${p.path}: ${p.message}\n      -> ${p.hint}`);
    for (const u of s.unscripted ?? []) console.log(`  [unscripted] ${u.id} (card ${u.card} "${u.name}"): ${u.text}`);
    for (const t of s.issues ?? []) console.log(`  [type] ${t.file}:${t.line} ${t.code} ${t.message}`);
    for (const f of s.failures ?? []) console.log(`  [game] ${f}`);
    if (s.raw) console.log(`  raw: ${s.raw}`);
  }
  console.log(ok ? "\nAll checks pass." : "\nFix the items above (mechanical ones yourself; DSL gaps and author questions are reported, not guessed).");
}
process.exit(ok ? 0 : 1);
