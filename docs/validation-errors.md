# Validation errors and what to do

`npm run validate` (`mc-pack validate .`) prints each problem as `<where>: <message>`. `npm run typecheck` checks your
scripts with TypeScript. `npm test` (`mc-pack test .`) plays headless games. `npm run build` also validates. This guide
lists the messages you will see, what each means and how to fix it.

Output shape of `npm run validate`:

```
my-hero@0.1.0: invalid
2 problems:
  cards/x.my-hero.03: card code must start with "x.my-hero."
  abilities/x.my-hero.03.slam: ability id names a card number the pack has no card for
1 unscripted ability (write them in abilities/):
  cards/x.my-hero.04: ability "x.my-hero.04.workshop-action" is defined by neither the pack nor the base game (not scripted yet)
```

"Problems" come first. "Unscripted abilities" are their own group: the pack is otherwise fine, you have not written
that script yet. `mc-pack validate . --allow-unscripted` passes a pack whose only issues are unscripted abilities (use
it while you work through an imported pack). `build` and `test` never allow them. Exit code 0 means valid, 1 a problem,
2 a usage error (a typo in the command).

The `<where>` prefix says what to open: `cards/<code>` is `cards/<code>.json`, `abilities/<id>` is the ability in
`abilities/index.ts`, `decks[n]`, `encounterSets[n]`, `scenarios/<id>` the records in those folders, `pack.json` ...
the manifest.

## Unscripted ability

```
cards/x.my-hero.04: ability "x.my-hero.04.workshop-action" is defined by neither the pack nor the base game (not scripted yet)
```

The card's `abilities` lists an id that `abilities/index.ts` does not define. Either write the script (see
[recipes.md](recipes.md), [dsl-reference.md](dsl-reference.md) and [finding-a-precedent.md](finding-a-precedent.md)) or,
if the card's text is only keywords or deck-building data, remove the id from the card. Check the spelling: the id in
the card and the key in the script must match exactly, including the face letter (`01b`).

## Card and id errors

| Message                                                                                  | Fix                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `card code must start with "x.<pack-id>."`                                               | A card `id` does not begin with your pack id. Rename the file and the `id` (and every reference). |
| `card code must be "x.<pack-id>.<number>" with an optional face letter`                  | Use digits plus at most one letter: `x.my-hero.01a`, not `x.my-hero.hero1`.                      |
| `card code is used by two cards`                                                         | Two records share an `id`. Renumber one.                                                         |
| `obligationCardId "..." is in neither the pack nor the base game`                        | The identity's obligation code is wrong or the obligation card is missing from `cards/`.         |
| `otherFaceId "..." ...`                                                                  | The linked other face is missing or mistyped.                                                    |
| `ability id must be "x.<pack-id>.<card number>.<slug>"`                                  | Ability ids are `<card code>.<slug>`, lowercase letters, digits and dashes in the slug.          |
| `ability id names a card number the pack has no card for`                                | The number in the ability key has no card (typo, or you deleted the card).                       |
| `ability id is already defined by the base game`                                         | You used a base-game ability id. Use your own pack's card code.                                  |
| `missing id`, `missing name`, `missing setCode`, `missing cycleId`, `missing collectorNumber`, `quantityInSet must be a positive number`, `missing/invalid unique flag` | A base field is missing (see [card-json.md](card-json.md)). |
| `<type> text must have non-empty printed and current strings`                            | `text` needs both `printed` and `current`. Use `""` for a card with no text only where allowed.  |
| `<type> deckLimit must be a positive integer`                                            | Player cards need `deckLimit` (usually the copies in the set).                                   |
| `<type> cost must be a non-negative number`                                              | `cost` is a number; a printed dash is `"specialCost": "dash"` with `"cost": 0`.                  |
| `ally atk must be a non-negative number, "X", or null` (also thw)                        | A printed dash is `null`; a number or `"X"` otherwise.                                           |
| `boostIcons must be a whole number of at least 0`                                        | Encounter cards and side schemes need `boostIcons`.                                              |
| `hero face missing faceName`, `identity must reference its obligationCardId`, `identity must reference its nemesisEncounterSetId`, `missing alterEgo face` | The identity record is incomplete: see the hero identity section of [card-json.md](card-json.md). |
| `identity ability <id> appears on more than one face`                                    | Each face lists its own abilities; the alter-ego's use the `b` code.                             |
| `has a keyword without a name`, `keyword ... needs a numeric value`, `uses keyword must have a count >= 1`, `hinder keyword perPlayer must be a positive whole number` | Fix the keyword object: see the keyword table in [card-json.md](card-json.md). |
| `references ability <id> twice`, `has an ability reference without an id`                | One id per entry, once per card.                                                                 |
| `could not be checked: ...`                                                              | The record has the wrong shape (for example a list where an object belongs). Read the rest of the message and compare with the example in [card-json.md](card-json.md). |

## Ability script errors

Errors from `abilities/index.ts` come from `definePackAbilities` when the file loads, as `invalid pack ability
definitions:` followed by `<ability id>: <problem>`, or from validate as `abilities/<id>: <problem>`. They are written
by the DSL's own checks; read the sentence, it names the field. Common ones:

- `abilities/index.ts must export a default ability registry`: the file must `export default definePackAbilities({ ... })`.
- `not an x.<pack-id>.<card number>.<slug> ability id`: a key that does not follow the id convention.
- A message that names a builder option or a missing field (for example an attack without a label): the effect you
  used needs another argument; open its doc comment in [dsl-reference-generated.md](dsl-reference-generated.md).
- `uses DSL feature "<feature>", which this game version lacks`: see below.
- TypeScript errors in `npm run typecheck` (for example `Argument of type ... is not assignable`): you passed an
  argument of the wrong kind (a card name where a query goes, a number where a predicate goes). The builder's signature
  is in the generated reference; the recipe in [recipes.md](recipes.md) shows a correct call.

## Uses DSL feature "..." which this game version lacks

```
abilities: uses DSL feature "effect:resolveTagged", which this game version lacks
```

The pack uses a builder whose underlying engine feature the installed SDK (and so the game version it came from) does
not support yet. Fix: update the SDK (`npm install @champions-digital-game/mod-sdk@latest`, which pins the new version
in `package.json`), run `npm run validate` again, and commit `package.json` and `package-lock.json`. If it still fails, the game has not added that primitive: do not rewrite the card to something else without
telling the author. Report it (see [AGENTS.md](../AGENTS.md)) and leave the ability unscripted for now.

`pack.json requires.dslFeatures: must list exactly the features the abilities use: ...` means `pack.json` carries a stale
feature list. Delete the `requires.dslFeatures` line from your `pack.json`: the build writes it. (The template's
`pack.json` does not have it.)

## Encounter sets, decks, scenarios

| Message                                                                                  | Fix                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `encounter set "<id>" has no record in the pack's encounter sets`                        | A card's `encounterSetIds` names a set that starts with your pack id but has no `encounter-sets/<id>.json`. Add the record. |
| `encounter set id must start with "<pack-id>-"`                                          | Name sets `<pack-id>-<name>`.                                                                    |
| `encounter set "<id>" is not this pack's: a card may not join a base-game set`           | A pack card may not join a base-game encounter set (RRG 1.8 p. 29). Use your own set.             |
| `nemesisOfIdentityId "<id>" is not a hero identity of this pack`                         | Point the nemesis set at your `x.<pack-id>.01a` identity.                                        |
| `the identity names "<set>" as its nemesis set, not this one`                            | The identity's `nemesisEncounterSetId` and the set's id disagree. Make them equal.              |
| `nemesis set "<id>" has no record in the pack's encounter sets`                          | Add `encounter-sets/<id>.json` with `nemesisOfIdentityId`.                                      |
| `"<field>" is not available to a pack's encounter set yet`                               | A pack's set only has `id`, `name`, `packCodes` (and `nemesisOfIdentityId`). Remove the field.  |
| `deck id must start with "<pack-id>-"`, `identity "..." is in neither the pack nor the base game`, `card "..." is in neither the pack nor the base game`, `card "..." needs a whole quantity of at least 1` | Fix the deck file: ids start with the pack id; every code must be a pack card or a real 5-digit base code. |
| `scenario id must start with "<pack-id>-"`, `packCode must be the pack's id`, scenario problems naming a field | A pack scenario has only the plain fields: see "Other records" in [card-json.md](card-json.md). |
| campaign errors (`campaign ...`)                                                         | See the SDK README's "Campaigns" section and `content-packs/sample-scenario/campaigns/` in the game repo; each message names the field. |

## pack.json, art and permission

| Message                                                                                  | Fix                                                                                              |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `pack.json id: must be lowercase letters, digits and single dashes, at most 64 characters` | Fix `id` (`my-hero`).                                                                           |
| `pack.json version: must be semver`                                                      | `"0.1.0"`, `"1.2.3"`.                                                                            |
| `pack.json kind: must be one of hero, scenario, modular, campaign, art`                  | Pick one.                                                                                        |
| `pack.json authors: must list at least one author`, `name`/`description`/`license: must be a non-empty string` | Fill them (`npm run describe` drafts them: see [pack-metadata.md](pack-metadata.md)). |
| `pack.json requires.app: must be a semver range`                                         | For example `">=0.1.0"`.                                                                         |
| `pack.json permission.by: must say who gave permission`, `permission.date: must be YYYY-MM-DD` | Fix the permission block, or remove it until you know the values. Evidence also goes in the registry file and `PERMISSION.md`. |
| `pack.json permission.status: must be one of ...`, `permission.<field>: is required when the status is granted` | `status` is `granted` or `pending`. A granted permission needs `date`, `evidence`, `scope` and `languages` (`npm run describe` flags, [pack-metadata.md](pack-metadata.md)). |
| `pack.json permission: is required to publish`, `permission.status: is pending, not granted, so the pack is not published` (`validate --publish`) | The store takes only packs whose creator granted permission. Record the grant, or wait for it. Never fill in permission nobody gave. |
| `pack.json permission.languages: does not cover <lang>: a translation needs the creator's permission too` (`validate --publish`) | Add the language once the creator allows it, or remove that language's pictures. |
| `CREDITS.md: required file is missing` / `is empty` (same for `PERMISSION.md`)           | Both files are required and must not be empty.                                                   |
| `pack.json pictures.<role>.<code>: "<path>" is not a listed file`                        | The art file named in `pictures` does not exist in the repo (`art/hero.webp`). Add it or fix the path. |
| `pack.json languages.base: must be one of the available languages`, `languages.available: must list language tags such as "en"` | Language tags are `en`, `es`, ...; `base` must be in `available`. |
| `card pictures need "languages" in pack.json`, `language "<x>" is not in languages.available` | You have `cards/<lang>/<code>.webp` files; declare the languages in `pack.json`.             |
| `"<code>" is not a card of this pack` (a picture)                                        | The picture file is named for a code that is not one of your cards. Rename it.                   |
| `altArt.<lang>.<code>: is a card neither the pack nor the base game has`, `"<path>" is not a listed file` | Alternate art names a real base card code (5 digits) or your card and an existing file. |
| `<path>: listed in pack.json but missing from the pack`, `in the pack but not listed`, `sha256 does not match`, `size is N bytes, pack.json says M` | A built pack's file list is out of date. Do not edit `pack.json`'s `files` or `totalBytes`; run `npm run build` again. |
| `unsafe file path (must be relative, with / separators and no .. or empty parts)`        | A file name with `..`, a backslash or a leading slash.                                           |

## Art and permission checks beyond the validator

The validator checks that files exist and the manifest is consistent. It does not check that you are allowed to
publish. Before you submit ([SUBMITTING.md](../SUBMITTING.md)):

- `PERMISSION.md` says who allows the store to distribute the pack, the scope, the date and where it was given. If you
  are submitting someone else's pack, their permission is required. Packs without permission are never approved.
- `CREDITS.md` names the creator, the template and artists, and the translators.
- Pictures are WebP, about 900 px on the long side. Do not include art you have no right to share.
- `npm run describe` lists what is still a `TODO` in these files.

## `npm test` failures

`mc-pack test .` first runs validate (a pack that does not validate is "not tested"). Then it plays headless games:

| Message                                                                 | Meaning and fix                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `setup failed: ...`                                                     | A deck or scenario could not start (an illegal deck: wrong card count, a card in the wrong aspect, an unknown card). Read the rest of the message. |
| an engine error, `illegal command` or `stuck` (no outcome inside the command limit) | A script or card data confuses the game. Re-read the card's text against its script; try `--games 1`; narrow down by deleting recently added cards from the deck. |
| `a prompt left open`                                                    | A choice was never answered; usually a script asks a question the harness could not drive. |
| `the log did not replay to the same state`                              | Non-determinism: do not use anything random outside the DSL's seeded choices.       |
| `note: ...` lines                                                       | Not failures: what the run could not cover (no deck, a hero with no scenario).        |

## Still stuck?

Run `npm run validate` and read the first problem only: later ones are often caused by it. Compare your record with the
matching example in [card-json.md](card-json.md), and your script with a recipe in [recipes.md](recipes.md). Then ask
in the [custom content discussion](https://github.com/quincarter/marvel-champions-digital-game/issues/488).
