---
name: validate-and-fix
description: Run the pack's validate, typecheck and test steps and get one compact list of issues with hints, then fix the mechanical ones. Use after any change to cards, abilities, decks or pack.json, before committing, and when CI fails.
---

# Validate and fix

Do not run `npm run validate`, `typecheck` and `test` by hand and read their raw output. Run the script: it runs all
three and prints a short, grouped list with a pointer to the explanation of each issue.

## 1. Run the script

```bash
node .agents/skills/validate-and-fix/scripts/check.mjs            # validate, typecheck, test (1 game per deck)
node .agents/skills/validate-and-fix/scripts/check.mjs --no-test  # skip the games while editing
node .agents/skills/validate-and-fix/scripts/check.mjs --json     # machine-readable
```

Output: one section per step (`validate`, `typecheck`, `test`) with `[problem]`, `[unscripted]`, `[type]` and `[game]`
lines. A broken pack is not played, so `test` is skipped when the others fail. Exit code 0 only when everything passes
(unscripted abilities count as failing).

## 2. What you do after

Handle the lines by kind, fixing, re-running, until clean:

- `[problem]`: mechanical, fix it. The `->` hint points into `docs/validation-errors.md`; the field shapes are in
  `docs/card-json.md`. Wrong code prefixes, missing fields, keyword shapes, encounter set records, stale
  `requires.dslFeatures` (delete it, the build writes it).
- `[type]`: a TypeScript error in a script. Check the builder's signature in `docs/dsl-reference-generated.md` and a
  recipe in `docs/recipes.md`. Fix the call; do not cast the error away.
- `[unscripted]`: not a fix. Hand them to the script-card skill.
- `uses DSL feature ... which this game version lacks`: run `npm install @champions-digital-game/mod-sdk@latest` and
  re-run (commit `package.json` and `package-lock.json` with the upgrade); if it persists it is a DSL gap, report it
  (AGENTS.md).
- `[game]`: a headless game failed. Find the card involved, re-read its text against its script and report; do not
  delete cards or weaken the deck to pass.

Never edit printed card text, `files`, `totalBytes` or `requires.dslFeatures` to make a check pass, and do not use
`--allow-unscripted` to claim success.
