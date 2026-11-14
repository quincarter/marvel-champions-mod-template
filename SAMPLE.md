# Sample Sentinel (sample-hero)

A small, original test hero for pack creators to copy. It shows each kind of player card done once, using only
primitives the game already has, so it needs no app update to run. It is not a Marvel character.

Read it next to [docs/recipes.md](docs/recipes.md), [docs/card-json.md](docs/card-json.md) and the game repo's
[custom content guide](https://github.com/quincarter/marvel-champions-digital-game/blob/main/docs/custom-content-packs.md)
(§6 scripting, §11.2 the SDK, §11.3 the template).

## What is in it

| Card code           | Card                       | Kind                         | Script modeled on       |
| ------------------- | -------------------------- | ---------------------------- | ----------------------- |
| `x.sample-hero.01a` | Sample Sentinel / Sam Pell | hero identity (both faces)   | Spider-Man 01001a/b     |
| `x.sample-hero.02`  | Rook                       | signature ally               | Black Cat 01002         |
| `x.sample-hero.03`  | Sentinel Slam (x3)         | signature event              | Swinging Web Kick 01005 |
| `x.sample-hero.04`  | Workshop                   | signature support            | Aunt May 01006          |
| `x.sample-hero.05`  | Sentinel Cell (x2)         | signature upgrade (Uses)     | Web-Shooter 01008       |
| `x.sample-hero.06`  | Overdue Notice             | obligation                   | Eviction Notice 01165   |
| `x.sample-hero.07`  | Rust Warden                | nemesis minion (Quickstrike) | Vulture 01167           |
| `x.sample-hero.08`  | Held for Ransom            | nemesis side scheme          | Highway Robbery 01166   |
| `x.sample-hero.09`  | Shock Wave (x2)            | nemesis treachery            | Sweeping Swoop 01168    |

`decks/sample-hero-justice.json` is a 40-card precon: the signature cards plus Core Set Justice and basic cards (Spider-Man's starter list, with extra copies up to each card's deck limit) from
the Core Set. A deck may name base-game card codes.

## Layout

```
pack.json              the author-written manifest (the build fills in files, sizes, hashes and dslFeatures)
cards/                 one JSON record per card, named after its code
encounter-sets/        one JSON record per encounter set the pack declares (here the nemesis set)
abilities/index.ts     default export: the pack's abilities, built with the SDK's DSL
decks/                 the precon
art/hero.svg           placeholder art, named in pack.json's `pictures`
CREDITS.md, PERMISSION.md
```

## How the hero is wired

- The identity record is one card with a `hero` and an `alterEgo` face. Each face lists its ability by id. Ability ids
  are `<card code>.<slug>`; the alter-ego face's uses `01b` (`x.sample-hero.01b.quiet-study`), as the base game does.
- `obligationCardId` is the obligation's card code. `nemesisEncounterSetId` is `sample-hero-nemesis`, and the three
  nemesis cards (07, 08, 09) carry `"encounterSetIds": ["sample-hero-nemesis"]`. At setup the engine shuffles the
  obligation into the encounter deck and sets the nemesis cards aside, matching them by that id. The id only has to be
  unique, so prefix it with your pack id.
- `encounter-sets/sample-hero-nemesis.json` declares that set: its id, its display name (`Sample Sentinel Nemesis`),
  `packCodes` (the pack id) and `nemesisOfIdentityId` (the identity's code). Validation fails when a card names a set
  whose id starts with the pack id and has no record here. `npm run init-pack` renames the file, its id and its
  references.
- Signature cards use `"aspect": "hero:x.sample-hero.01a"`.
- A treachery that names a card (Shock Wave names Rust Warden) writes the exact printed name in the script.

## Building and testing

`npm run validate` checks the pack, `npm test` plays the precon headless against the Core Rhino scenario, and
`npm run build` writes the release zip to `build/`. CI runs all three on every push.

## Known gaps

- None the sample hits today. Encounter set names can now be declared in `encounter-sets/`, so the client shows
  `Sample Sentinel Nemesis` rather than the set's id.
