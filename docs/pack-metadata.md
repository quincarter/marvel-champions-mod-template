# Pack metadata: pack.json, CREDITS.md, PERMISSION.md and the registry file

When the cards are done, the pack still needs its description: `pack.json`, `CREDITS.md`, `PERMISSION.md`, and for the
Mod Store a `packs/<id>.yaml` file in the registry. This guide says what each holds and how to generate them from the
finished cards plus a few facts only the creator knows. It is written for an AI assistant and for you.

## The fast way

```bash
npm run describe                 # prints drafts of all four files and a TODO list
npm run describe -- --json       # the same as JSON
npm run describe -- --write      # writes pack.json, CREDITS.md, PERMISSION.md and submission/<id>.yaml
```

`scripts/describe.mjs` reads what is in the repo (the cards, decks, encounter sets, scenarios, campaigns, picture
folders, `art/`, the git remote and tags) and drafts everything it can. Whatever it cannot know it leaves as a
`TODO:` line and lists under "TODO" at the end. Fill the TODOs with flags rather than by hand, then run it again:

```bash
npm run describe -- --creator "Your Name" \
  --permission-status granted --permission-by "Your Name" --permission-date 2026-11-11 \
  --permission-evidence "I made this pack myself" --permission-scope inclusion --permission-languages en \
  --repo https://github.com/you/my-hero-pack --write
```

Flags: `--creator`, `--permission-status granted|pending`, `--permission-by`, `--permission-date YYYY-MM-DD`,
`--permission-scope`, `--permission-evidence`, `--permission-languages en,es`, `--permission-note`,
`--template-credit`, `--translator es="Name"` (repeatable), `--base-language`, `--text-language`, `--summary`, `--repo`,
`--tag`, `--app`, `--mod path/to/mod.json`. Existing values in `pack.json` win; a TODO is never written into `pack.json`
(the script refuses and says what is missing). `--write` keeps a `CREDITS.md` or `PERMISSION.md` you have already
written (one with no `TODO` and no sample text); pass `--force` to replace them.

The assistant's job here: run `npm run describe -- --json`, ask the creator for each TODO the script lists (who made
the cards and art, who allows distribution, the evidence), rerun with the flags, then proofread the result. Do not
invent permission or evidence. If the creator is not the author of the cards, permission from the author is required.

## pack.json

The author-written part (the build adds `schema`, `contents`, `files`, `totalBytes` and `requires.dslFeatures`).

| Field                    | What it is                                                                                              | How it is drafted                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `id`                     | Lowercase letters, digits, single dashes; prefixes every card code. Must not change after release.      | From the existing `pack.json`.                                  |
| `version`                | Semver. Bump it for every release; a published version is never replaced.                                | Existing, else `0.1.0`.                                         |
| `kind`                   | `hero`, `scenario`, `modular`, `campaign` or `art` (`house-rule` is coming in a game release).                                                      | From the cards: a hero identity means `hero`; scenarios `scenario`; a campaign `campaign`; encounter sets only `modular`; only alternate art `art`. |
| `name`                   | Display name.                                                                                            | Existing, else the first hero's name.                           |
| `authors`                | A list of names.                                                                                         | `--creator`, else TODO.                                         |
| `description`            | One or two sentences for the store (its first line is the default store summary).                         | A one-line draft; improve it.                                   |
| `license`                | `Fan-made, non-commercial; see CREDITS.md`.                                                              | Constant.                                                       |
| `requires.app`           | The oldest game version that has every engine feature the scripts use, as a semver range.                | `>=0.1.0`; `npm run build` prints the real minimum, raise it if needed. |
| `languages`              | `{ "base": "en", "available": ["en", "es"], "text": "en" }`. `base` is the fallback picture language; `available` has every `cards/<lang>/` folder; `text` is the language of the card records, only when it differs from `base`. | From the `cards/<lang>/` folders; `--base-language`, `--text-language`. |
| `pictures`               | `{ "hero": { "<identity code>": "art/hero.webp" } }`: the hero select picture.                            | From `art/hero.*`.                                              |
| `altArt`                 | `{ "en": { "01088": "alt-art/en/01088.webp" } }`: alternate art for base cards or your own.               | From `alt-art/<lang>/<code>.webp`.                              |
| `permission`             | `{ "status", "by", "date", "evidence", "scope", "languages", "note" }`: whether it is `granted` or `pending`, who allowed the store to distribute it, when, the proof, how far, which languages it covers (the original and each translation), and while pending what is missing. A `granted` one needs all but `note`. The store takes only `granted`, with `languages` covering every language in `languages.available` (`npx mc-pack validate . --publish`). | Flags, or `mod.json`. Never assumed. |
| `templateCredit`         | The card template's creator (for example `Hitch`).                                                        | `--template-credit` or `mod.json` `template`.                   |
| `translators`            | `{ "es": "Name" }`.                                                                                       | `--translator` or `mod.json` `languages`.                       |

`pictures`, `altArt` and `languages` are optional; leave them out if the pack has no card pictures yet.

## CREDITS.md

Required, not empty. State: the pack's creator; the template and artists; translators; where the character art comes
from (your own, commissioned, Marvel comics art as used by the author); who wrote the ability scripts; and the
standard line "Marvel Champions: The Card Game is the property of Fantasy Flight Games and Marvel." The describe script
drafts it from `pack.json` and leaves `TODO:` lines for the facts it cannot know.

## PERMISSION.md

Required, not empty. State who allows the Mod Store to distribute the pack, the status (`granted`), the scope (for
example `inclusion` or `inclusion and translation`), the date, and where it was given (a link or a quoted message).
If you made the pack, you are the one giving permission. If you are submitting someone else's pack, their permission
is required and the evidence is how they gave it. Packs without permission are never approved. If permission is not
granted, write that plainly and do not submit (the importer writes "Permission is not recorded as granted ... Do not
publish it").

## The registry file

The store lists only approved packs. Approval is a pull request to the
[registry](https://github.com/quincarter/marvel-champions-mods) that adds `packs/<id>.yaml`
(see [SUBMITTING.md](../SUBMITTING.md)):

```yaml
id: my-hero
repo: https://github.com/<you>/<your-pack-repo>
tag: v1.0.0
commit: <the full commit sha the tag points at>
creator: <you>
permission:
  by: <you, or whoever granted permission>
  evidence: <a link to where permission was given>
  date: YYYY-MM-DD
tags: [hero]
summary: One line for the store list. # optional; defaults to the first line of the description
```

`npm run describe` writes a draft to `submission/<id>.yaml` (git-ignored); copy it into the registry's `packs/`. The
`commit` is known only after you tag: run `git rev-parse v1.0.0^{commit}`. The `submit-pack` skill
(`.agents/skills/submit-pack/scripts/submit.mjs`) checks tag, commit and TODOs and prints the final file.

## Mapping a `mod.json` (BluefireF5ran-style community packs)

Community packs curated in MarvelCDB's shape carry a `mod.json` beside their card data. The SDK's importer
(`npx mc-pack import-marvelcdb <folder> --out .`) reads it, and `npm run describe` reads it too if a `mod.json` is in the
repo root or given with `--mod`. The fields map like this:

| `mod.json` field                      | Becomes                                                                                      |
| ------------------------------------- | -------------------------------------------------------------------------------------------- |
| `id` (`ember_test`)                   | Pack id in kebab case (`ember-test`); card codes become `x.<pack-id>.<NN>`.                  |
| `name`                                | `pack.json` `name`.                                                                          |
| `kind` (`hero_pack`)                  | `kind` (`hero`, `scenario`, `modular`, `campaign`, `art`; a `_pack` suffix is dropped).       |
| `author`                              | `authors: [author]`; `CREDITS.md` "Card design and art direction"; `permission.by` when granted. |
| `template`                            | `templateCredit`; `CREDITS.md` "Card template".                                              |
| `version` (`"1.2 (test edition)"`)    | `version` as semver from its leading number (`1.2.0`); if it has none the pack is `0.1.0`; the original text goes in `CREDITS.md` as "Source version". |
| `permission.status`                   | `granted` is required to submit; anything else makes `PERMISSION.md` say "Do not publish it". |
| `permission.scope`                    | `permission.scope`.                                                                          |
| `permission.date`                     | `permission.date` (YYYY-MM-DD). If missing it is a TODO; the registry review asks for it.    |
| (no field)                            | `permission.evidence`: ask for a link or quoted message.                                      |
| `languages.base`                      | `languages.base` (the fallback picture language).                                            |
| `languages.<lang>: "Name"`            | `translators.<lang>`; `"author"` means the author made that language (no credit line).       |
| `files.images`, `files.alt_art`       | Folders of pictures: `images/<lang>/` becomes `cards/<lang>/<code>.webp`, `alt-art/<lang>/` becomes `alt-art/`; also `altArt` in `pack.json`. |
| `open` (a list of strings)            | Open items: each is a note to resolve; describe lists them as TODOs, the importer prints them. |
| `status` (`ready`, `waiting_author`)  | Anything but `ready` is a TODO (for example the author has not confirmed fixes).              |
| `x_*` fields on cards                 | The author's own extensions: the importer keeps them in `extensions.json` beside the pack.   |

Language note: a pack whose base language is Spanish with English card text has `"languages": { "base": "es",
"available": ["es", "en"], "text": "en" }` (Gwenpool in the game repo is an example).

The three community packs in the game repo (`content-packs/community/carnage-nep`, `night-thrasher-dh`, `gwenpool-ptt`)
show finished `pack.json`, `CREDITS.md` and `PERMISSION.md` files made this way, including a permission with scope and
date, and one whose permission date is still to be asked of the curator.
