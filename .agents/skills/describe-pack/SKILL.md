---
name: describe-pack
description: Draft the pack's metadata (pack.json, CREDITS.md, PERMISSION.md, registry yaml) from the finished cards with the describe helper, then fill the TODOs by asking the creator. Use when the cards are done and the pack needs its description, credits or permission, or when mapping a community mod.json.
---

# Describe the pack

The helper (`scripts/describe.mjs`, also `npm run describe`) drafts everything derivable from the repo. You ask only
for what it cannot know.

## 1. Run the script

```bash
node .agents/skills/describe-pack/scripts/describe.mjs           # compact summary and the TODO list
node .agents/skills/describe-pack/scripts/describe.mjs --full    # also print the drafted files
```

It prints what was found (cards by type, heroes, decks, scenarios, picture languages, a `mod.json` if present) and the
TODOs: creator, permission (who, date, evidence, scope), template credit, translators, `requires.app`, the registry
repo and commit.

## 2. What you do after

1. Ask the creator for each fact the TODOs list, in one short batch. Never invent permission, a date or evidence. If
   the creator did not make the cards, the author's permission is required.
2. Re-run with the answers as flags, then write:

```bash
node .agents/skills/describe-pack/scripts/describe.mjs --creator "Name" --permission-by "Name" \
  --permission-date 2026-11-11 --permission-evidence "https://..." --template-credit "Hitch" \
  --translator es="Name" --repo https://github.com/you/pack --write
```

   (`--mod path/to/mod.json` reads a community `mod.json`; the field mapping is in `docs/pack-metadata.md`.)
3. Proofread the generated `description` (it is the store's text) and `CREDITS.md`; improve wording, keep facts.
   Replace any remaining `TODO:` in `CREDITS.md` (where the art comes from, who wrote the scripts) with the creator's
   answers.
4. Run the validate-and-fix skill. When ready to publish, use the submit-pack skill.
