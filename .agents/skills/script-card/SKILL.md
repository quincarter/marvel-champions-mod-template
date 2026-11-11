---
name: script-card
description: List the abilities that still have no script, each with its card, printed text and the builder its timing word suggests, then write the scripts from precedents. Use whenever `npm run validate` reports unscripted abilities or a new card needs its ability written.
---

# Script a card's abilities

The script does the bookkeeping (which abilities are missing, what the text says, which builder the timing word
suggests). You do the part that needs judgment: read the text, find a precedent, write the script.

## 1. Run the script

```bash
node .agents/skills/script-card/scripts/stub.mjs                 # every unscripted ability
node .agents/skills/script-card/scripts/stub.mjs --card x.my-hero.03
node .agents/skills/script-card/scripts/stub.mjs --write         # also add TODO comments to abilities/index.ts
```

For each card it prints the ability ids to script, each printed ability line, the suggested builder
(`heroAction({ ... }, ...effects)`, `forcedResponse(after.<event>, ...)`, ...) and hints (a label such as
`(attack)`, a limit, a cost before the arrow, "would" wording). `--write` adds only comments, never code.

## 2. What you do after

For each ability, one at a time:

1. Read `docs/recipes.md`: the text may be a recipe already.
2. Otherwise run the find-precedent skill with the text's wording and read the best match's script.
3. Write the ability in `abilities/index.ts` under its id, with a comment quoting the text and naming the precedent
   (`// Modeled on Black Cat (01002): ...`). Look up each builder's exact signature in
   `docs/dsl-reference-generated.md`.
4. Timing words are exact: Interrupt/When, Response/After, Forced, Hero/Alter-Ego, (attack)/(thwart)/(defense),
   "would", "Then", "if you do". Map each to its builder; do not approximate.
5. If the text reads two ways, ask the author (or the rules-reader agent) with both readings and a recommendation.
   If no builder can express it, leave the ability unscripted and report a DSL gap. Never guess.
6. After a batch, run the validate-and-fix skill. Re-run this script: the list should shrink.

Keywords (Retaliate, Guard, Surge, Toughness, Uses ...) are card data, not scripts: if the unscripted list names an
ability that is only a keyword, remove it from the card's `abilities` instead.
