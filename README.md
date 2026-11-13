# Custom pack template

Start here to make a custom content pack (a fan-made hero, and later scenarios and modular sets) for the
[Marvel Champions digital game](https://github.com/quincarter/marvel-champions-digital-game), and to submit it to the
in-game **Mod Store**.

This is a fan-made, non-commercial project. Marvel Champions, its card text, artwork and characters are the
intellectual property of Fantasy Flight Games and Marvel. Only submit content you made, or have its creator's
permission to share.

## Quick start

1. Click **Use this template** to make your own repo, then clone it.
2. Install the SDK, which also gives you the `mc-pack` tool, and commit the `package-lock.json` it writes (CI
   installs with `npm ci`, and fails until the lockfile is committed):

   ```bash
   npm install
   git add package-lock.json && git commit -m "Lock the SDK"
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

5. Draft the pack's metadata (`pack.json`, `CREDITS.md`, `PERMISSION.md`, the registry file) from your finished
   cards, then fill the `TODO`s it lists:

   ```bash
   npm run describe
   ```

6. Push, and tag a release (`v0.1.0`) once CI passes. Then follow [SUBMITTING.md](SUBMITTING.md).

## Upgrading the SDK

`package.json` pins `@champions-digital-game/mod-sdk` to one exact version, and `package-lock.json` locks it and
everything it pulls in, so every `npm ci` (yours and CI's) builds with the SDK you tested. Upgrade it on purpose,
for example when a card needs an engine feature from a newer game release:

```bash
npm install @champions-digital-game/mod-sdk@<version>   # or @latest; .npmrc keeps the pin exact
npm run validate && npm run typecheck && npm test
git add package.json package-lock.json && git commit -m "SDK <version>"
```

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
| `AGENTS.md`, `.agents/`, `docs/` | Instructions, subagents, skills and guides for AI assistants and humans.                    |

The sample, Sample Sentinel, shows one card of each kind. Each ability copies the shape of a base-game card whose
script is known to work, named in a comment. [SAMPLE.md](SAMPLE.md) lists them.

## Scripting cards

A pack ships data, never code. Your `abilities/index.ts` is run once when the pack is built, and its result is saved
as JSON. The game only ever reads that JSON. So a card can only do what the game's engine already supports.

- Start with [docs/recipes.md](docs/recipes.md): common card text already turned into scripts. Find a base-game card
  that works like yours ([docs/finding-a-precedent.md](docs/finding-a-precedent.md)) and copy the shape of its script. The game's
  [card scripts](https://github.com/quincarter/marvel-champions-digital-game/tree/main/packages/cards/src) are the
  best reference.
- `npm run validate` lists every engine feature the pack uses, and fails if one is unknown to the SDK's engine.
- If a card needs something new (a new keyword, timing or effect), the game has to add it first, in a game release.
  Ask in the [custom content discussion](https://github.com/quincarter/marvel-champions-digital-game/issues/488).

Already have cards in MarvelCDB's JSON format? `npx mc-pack import-marvelcdb <folder> --out .` converts them,
renumbers the codes and writes an `abilities/index.ts` stub listing every ability still to script.

## Guides

Plain markdown, written to be read by an AI assistant as well as by you:

| Guide | What it covers |
| ----- | -------------- |
| [docs/card-json.md](docs/card-json.md) | Every card field by type, required or optional, enums, code and id rules, an example per type. |
| [docs/dsl-reference.md](docs/dsl-reference.md) | The ability DSL by group, with examples. [docs/dsl-reference-generated.md](docs/dsl-reference-generated.md) is the complete builder list, generated from the game's source. |
| [docs/recipes.md](docs/recipes.md) | Common card text turned into scripts, each citing the base or community card it comes from. |
| [docs/finding-a-precedent.md](docs/finding-a-precedent.md) | How to find a base-game card that does what yours does and read its script. |
| [docs/validation-errors.md](docs/validation-errors.md) | Every message `validate`, `typecheck` and `test` print, and what to do. |
| [docs/pack-metadata.md](docs/pack-metadata.md) | `pack.json`, credits, permission, the registry file, and how a community `mod.json` maps onto them. |

`npm run describe` drafts the metadata from your cards (`--write` saves it). `AGENTS.md` tells an AI assistant how to
work in this repo.

## Working with an AI assistant

`AGENTS.md` is the one set of instructions every tool reads (`CLAUDE.md`, `GEMINI.md` and
`.github/copilot-instructions.md` link to it). `.agents/agents/` has small subagents (`card-transcriber`,
`ability-scripter`, `pack-validator`, `pack-describer`, `rules-reader`) and `.agents/skills/` has skills that run a
script first and use AI only for the rest, which saves tokens: `import-pack`, `transcribe-cards`, `find-precedent`,
`script-card`, `validate-and-fix`, `describe-pack`, `submit-pack`. After cloning, `npm run agents:link` recreates the
links where your system did not check them out as links (Windows without Developer Mode).

The assistant never invents mechanics the engine lacks, never guesses unclear card text, and cites the base card each
script copies; see `AGENTS.md`.

## Images

Card faces are WebP, about 900 px on the long side (portrait about 628×900, side schemes 900×628), quality around
85. That keeps a 40-card hero pack to about 5 MB.
