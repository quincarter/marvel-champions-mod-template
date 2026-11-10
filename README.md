# Custom pack template

Start here to make a custom content pack (a fan-made hero, and later scenarios and modular sets) for the
[Marvel Champions digital game](https://github.com/quincarter/marvel-champions-digital-game), and to submit it to the
in-game **Mod Store**.

This is a fan-made, non-commercial project. Marvel Champions, its card text, artwork and characters are the
intellectual property of Fantasy Flight Games and Marvel. Only submit content you made, or have its creator's
permission to share.

## Quick start

1. Click **Use this template** to make your own repo, then clone it.
2. Install the SDK, which also gives you the `mc-pack` tool:

   ```bash
   npm install
   ```

3. Turn the sample into your pack:

   ```bash
   npm run init-pack -- --id my-hero --name "My Hero" --author "Your Name"
   ```

4. Edit `cards/`, `abilities/`, `decks/` and `art/`. Run these as you go:

   ```bash
   npm run validate     # schema, card codes, abilities, files, credits
   npm run typecheck    # your ability scripts
   npm test             # plays headless games with your precon
   ```

5. Commit `package-lock.json`, push, and tag a release (`v0.1.0`) once CI passes. Then follow
   [SUBMITTING.md](SUBMITTING.md).

## What's in a pack

| Path                        | What it is                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| `pack.json`                 | The pack's id, version, kind, name, authors, description, license and which game version it needs. |
| `cards/<code>.json`         | One record per card. Codes are `x.<pack-id>.<NN>`, with `a`/`b` for the two faces of a card.     |
| `abilities/index.ts`        | The cards' abilities, written with the game's ability DSL (`definePackAbilities`).               |
| `decks/<pack-id>-*.json`    | Precon decks. A deck may also list base-game card codes.                                         |
| `cards/<lang>/<code>.webp`  | Card faces, per language (`en`, `es`, …). A language a card lacks falls back to the base one.    |
| `art/`                      | Full-bleed pictures, such as the hero select picture.                                            |
| `CREDITS.md`                | Who made the pack, its art and any translations.                                                 |
| `PERMISSION.md`             | Permission for the Mod Store to distribute the pack.                                             |

The sample, Sample Sentinel, shows one card of each kind. Each ability copies the shape of a base-game card whose
script is known to work, named in a comment. [SAMPLE.md](SAMPLE.md) lists them.

## Scripting cards

A pack ships data, never code. Your `abilities/index.ts` is run once when the pack is built, and its result is saved
as JSON. The game only ever reads that JSON. So a card can only do what the game's engine already supports.

- Find a base-game card that works like yours and copy the shape of its script. The game's
  [card scripts](https://github.com/quincarter/marvel-champions-digital-game/tree/main/packages/cards/src) are the
  best reference.
- `npm run validate` lists every engine feature the pack uses, and fails if one is unknown to the SDK's engine.
- If a card needs something new (a new keyword, timing or effect), the game has to add it first, in a game release.
  Ask in the [custom content discussion](https://github.com/quincarter/marvel-champions-digital-game/issues/488).

Already have cards in MarvelCDB's JSON format? `npx mc-pack import-marvelcdb <folder> --out .` converts them,
renumbers the codes and writes an `abilities/index.ts` stub listing every ability still to script.

## Images

Card faces are WebP, about 900 px on the long side (portrait about 628×900, side schemes 900×628), quality around
85. That keeps a 40-card hero pack to about 5 MB.
