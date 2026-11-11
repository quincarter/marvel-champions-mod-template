# Finding a precedent

The fastest, safest way to script a card is to find a base-game card that does the same thing and copy the shape of
its script. The base game has scripts for hundreds of cards, all tested. This guide says where they are and how to
find the right one. The [game repo](https://github.com/quincarter/marvel-champions-digital-game) is public.

Always cite the card you copied from, in a comment above the ability, as the sample packs do:

```ts
// Modeled on Swinging Web Kick (01005): Hero Action (attack): Deal 8 damage to an enemy.
```

## The shortcut: run the script

If you work with an AI assistant, or just want the answer quickly, the `find-precedent` skill ships a script that
does everything below. From the repo root:

```bash
node .agents/skills/find-precedent/scripts/find.mjs "deal damage to each hero"
node .agents/skills/find-precedent/scripts/find.mjs --builder forcedInterrupt --limit 5
```

The first form searches base-game card text and prints the best matches with the file and line of each card's
script. The second lists scripts that use a builder. On first use it makes a sparse clone of the game repo into
`.cache/game-repo` (about 60 MB; git only). Set `MC_GAME_REPO=/path/to/clone` to use a clone you already have. Read the
top match's script, copy the shape, and cite it.

## Where things are in the game repo

| What you want                                  | Where                                                                                  |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| A base card's printed text and fields          | `packages/content/src/data/<set>/cards.ts` (the card's `text.printed`, `keywords`, `abilities`) |
| Its script                                     | `packages/cards/src/...`: find it by the ability id (below)                            |
| The DSL builders' source and doc comments      | `packages/cards/src/dsl/abilities.ts`, `effects.ts`, `values.ts`                       |
| Worked community packs                         | `content-packs/community/carnage-nep`, `night-thrasher-dh`, `gwenpool-ptt` (their `abilities/index.ts` comment each ability with the base card it copies) |
| The sample packs                               | `content-packs/sample-hero`, `content-packs/sample-scenario`                           |
| What each DSL builder is tested to do          | `packages/cards/src/dsl/*.test.ts` (one test file per primitive; read the one named after the builder) |

## Card code to file

Base cards have 5-digit codes (`01005`, `29001a`). The ability ids are `<card code>.<slug>`: Swinging Web Kick's is
`01005.swinging-web-kick-action`. So:

1. **Find the code** of a card that reads like yours: search `packages/content/src/data/*/cards.ts` for a phrase from
   its text (`grep -rn "to each hero" packages/content/src/data --include=cards.ts`), or browse the card on
   [MarvelCDB](https://marvelcdb.com) and read the code in its URL.
2. **Find its script** by the ability id: `grep -rn '"01005\.' packages/cards/src --include=*.ts --exclude=*.test.ts`.
   The file is the script; the line is the ability.

Where the scripts live, roughly:

| Codes / content                | Folder in `packages/cards/src/`                                                  |
| ------------------------------ | -------------------------------------------------------------------------------- |
| Core Set heroes (`01xxx`)      | `core/heroes/<hero>.ts`                                                         |
| Core aspect cards              | `core/aspects/<aspect>.ts` (`aggression`, `justice`, `leadership`, `protection`, `basic`) |
| Core encounter cards           | `core/scenarios/<scenario>.ts`, `core/modular/<set>.ts`, `core/obligations.ts`   |
| Later products                 | `wave<N>/<pack>/<hero or set>/...`: `identity.ts`, `events.ts`, `support-upgrades-allies.ts`, `obligation-nemesis.ts`; a few packs keep one file per set |
| DSL builders                   | `dsl/`                                                                           |

A hero's pack folder is split by card kind, so an event script is in that folder's `events.ts`. If the grep finds
nothing, the card may be a reprint, covered by an engine rule (`coveredByEngineRule()`), or data only (keywords).

## Search tips

- **Search by wording, not by effect.** Cards phrase the same effect the same way. `grep -rn "remove 1 threat from a
  scheme"` finds every card with that sentence in `content/src/data`.
- **Search by builder.** If you know the builder (`forcedInterrupt`, `searchAndReveal`, `reduceNextCardCost`), grep for
  it in `packages/cards/src` (excluding tests) to see how others pass the arguments.
- **Search by timing.** A "When Revealed" treachery that stuns is `whenRevealed(stun(...))`; grep for `whenRevealed(` and
  the effect name together.
- **Read the test beside the script.** Most scripts have a `.test.ts` next to them that plays the card; the
  `packages/cards/src/dsl/<primitive>.test.ts` files show an engine primitive in isolation.
- **Prefer a base card over a community card**, and a card from the Core Set over a late one: the older scripts are
  the best exercised. A community pack's script is a good second source when the card text is close (they cite their
  base card).
- **Copy the shape, not the numbers.** Change the amounts, targets and names to your card's text. Re-read the printed
  text after copying: a precedent that is close but not identical is the usual way a wrong script gets in.

## No precedent?

If nothing in the base game or community packs does what your card does, look in
[dsl-reference-generated.md](dsl-reference-generated.md) for a builder that fits (search the builder doc comments for
a key word of your text). If there is still nothing, the engine may lack the mechanic: report it (see
[AGENTS.md](../AGENTS.md)) and leave the ability unscripted rather than approximating.
