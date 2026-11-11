---
name: find-precedent
description: Find the base-game card whose text matches a custom card's wording and print the file and line of its script, so you can copy its shape and cite it. Use before writing any ability script, whenever you need to know how a base card does something.
---

# Find a precedent

Every ability script should start from a base-game card that does the same thing. Run the script to find it; do not
search the game's source by hand.

## 1. Run the script

```bash
# by card text: use the card's verbs and nouns, not its whole sentence
node .agents/skills/find-precedent/scripts/find.mjs "deal damage to each hero" [--type minion] [--limit 8]
# by builder: how do other scripts call it?
node .agents/skills/find-precedent/scripts/find.mjs --builder forcedInterrupt --limit 5
```

First use makes a sparse clone of the game repo into `.cache/game-repo` (git and network; about 60 MB) and builds a
cached index. To use an existing clone: `--repo <path>` or `MC_GAME_REPO=<path>`. `--refresh` rebuilds the index.

It prints the best matches: card code, name, type, printed text, and `script: <ability id> -> <file>:<line>`.
"no script found" means the card is data only, a reprint, or covered by an engine rule.

## 2. What you do after

1. Pick the match whose text is closest (same timing word, same effect, same targets). Prefer Core Set and older cards.
2. Open the script at the printed `file:line` (the game repo clone is under `.cache/game-repo`) and read the ability
   and the lines around it. Read the card's neighbor tests (`*.test.ts` beside it) if the behavior is unclear.
3. Write your script with the same shape, changing amounts, targets and names to your card's text. Re-read your
   card's printed text against the result: a close but different precedent is how a wrong script gets in.
4. Cite it in a comment above the ability: `// Modeled on <Card Name> (<code>): <its text>`.
5. If no match fits, search the builder list in `docs/dsl-reference-generated.md`; if still nothing, the engine may
   lack the mechanic: report a DSL gap (AGENTS.md), do not approximate.

A search with no result: try fewer or different words, a different `--type`, or search by `--builder`.
`docs/finding-a-precedent.md` explains where scripts live if you need to look by hand.
