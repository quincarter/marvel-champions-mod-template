# Agent instructions: a Marvel Champions custom content pack

This file is for any AI coding assistant (Claude Code, Codex, Gemini CLI, Copilot, Cursor, ...) working in this repo,
and for humans. `CLAUDE.md`, `GEMINI.md` and `.github/copilot-instructions.md` are links to this file; the subagents and
skills below live in `.agents/`. If the links are missing (or are small text files), run `npm run agents:link`.

## What this repo is

A **custom content pack** for the [Marvel Champions digital game](https://github.com/quincarter/marvel-champions-digital-game):
a fan-made hero (later scenarios and modular sets), made of card JSON files, an ability script file and card pictures,
built and validated with the game's SDK (`@champions-digital-game/mod-sdk`, the `mc-pack` tool). It is submitted to the
in-game Mod Store through a registry pull request. `SUBMITTING.md` is the step-by-step guide for the whole path;
the step numbers below are its steps.

This is a fan-made, non-commercial project. Marvel Champions, its card text, artwork and characters are the intellectual
property of Fantasy Flight Games and Marvel. Only work on content the creator made or has permission to share.

## The rules for working here

1. **A pack is data, never code.** `abilities/index.ts` runs once at build time and its result is saved as JSON; the game
   only reads the JSON. A card can only do what the game's engine already supports. Write abilities with the DSL
   builders, never as custom code or by editing the engine.
2. **Authority.** For what a custom card does, the **pack's own printed text** is the authority. For everything the text
   does not override (timing, costs, what counts as an attack, "would", "then"), the **Rules Reference Guide** and FFG
   rulings. Community sites are pointers, never authorities.
3. **Never invent a mechanic.** If no DSL builder expresses part of a card's text, the engine lacks the mechanic. Do not
   approximate it, do not write a nearly-right script, do not change the card. Leave that ability unscripted and
   **report it** as a DSL gap: the card, the text, what you searched, the closest builder. The game has to add the
   primitive in a release (ask in the [custom content discussion](https://github.com/quincarter/marvel-champions-digital-game/issues/488)).
4. **Never guess unclear card text.** If a card reads two ways or a field is illegible, do not choose silently. Ask the
   author, with both readings and a recommended default, or use the `rules-reader` agent. A wrong script that looks
   right is worse than an unwritten one. Record the author's answer as a comment in the script.
5. **Cite the precedent.** Every script starts from a base-game card that does the same thing and says so in a comment
   (`// Modeled on Swinging Web Kick (01005): ...`). Find it with the find-precedent skill. Copy the shape, then
   re-read your card's text against the result.
6. **Targets and choices belong to the player.** Model them as explicit DSL choices (`anEnemy("foe")`, `chooseOne`).
7. **Do not edit printed card text to fit a script.** If the text and the script disagree, the text wins; fix the script.
8. **Keywords are card data** (`keywords` in the card JSON), not scripts. Scripts only read or grant them.
9. **Never invent permission, credits or evidence.** Ask the creator. Packs without permission are never approved.
10. Do not hand-edit `files`, `totalBytes` or `requires.dslFeatures` in `pack.json`; the build writes them.

## The authoring loop

```
card pictures / card text / a community mod.json
        |  transcribe-cards (script + AI)         or  import-pack (mc-pack import-marvelcdb)
        v
cards/<code>.json   -->  abilities/index.ts  (script-card + find-precedent)
        |
        v
npm run validate  ->  npm run typecheck  ->  npm test        (validate-and-fix runs all three, compactly)
        |
        v
describe-pack  ->  pack.json, CREDITS.md, PERMISSION.md, permission block (the creator's facts, never invented)
        |
        v
the creator: push, CI green, tag v<version>  ->  a release carrying <id>-<version>.zip
        |
        v
submit-pack  ->  submission/<id>.yaml  ->  (the creator says go)  ->  registry pull request
```

1. Get card JSON into `cards/` (write it, import it, or transcribe it from pictures). SUBMITTING.md step 4.
2. Script each ability in `abilities/index.ts`.
3. `npm run validate`, `npm run typecheck`, `npm test`, `npm run build`. Fix until all pass. An unscripted ability is
   a failure. Step 5.
4. Draft the metadata (`npm run describe`) and ask the creator for the facts it lists, including the permission:
   status, who, date, evidence, scope and languages. Steps 6 and 7.
5. The creator pushes, waits for green CI and tags `v<version>`; CI's release job attaches the zip. Step 8. Run these
   commands for them only when they ask you to.
6. Run the submit-pack skill. It writes the registry file; you open the registry pull request only after the creator
   confirms. Steps 9 to 11.

### Releasing and submitting: what you may and may not do

- **Permission is the creator's to give.** Ask the creator for the permission facts in one batch: who gave it, when,
  the evidence (a link, or the quoted message and where it is kept), the scope and the languages it covers. If they
  did not make the pack, the evidence must come from the person who did. Never write `--permission-status granted`,
  a date or evidence they did not give you. If they cannot show it, record `pending` with a `note` and stop: the pack
  is not submitted.
- **Ask before anything that leaves the machine:** pushing, tagging, forking the registry, pushing a branch to it,
  opening the pull request. Show the creator the exact file and pull request text first.
- **Never move a pushed tag or replace a release's zip.** To change anything after a tag, bump `version` and tag
  again.
- **Never edit another pack's file in the registry**, approve a pull request, or publish anything: merging is the
  maintainer's.

Commands (from the repo root):

| Command                       | What it does                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `npm run init-pack -- --id my-hero --name "My Hero" --author "Name"` | Turns the sample pack into yours (first run only). |
| `npm run validate`            | Schema, card codes, abilities, files, credits (`mc-pack validate .`).             |
| `npm run typecheck`           | Type-checks the ability scripts (`tsc --noEmit`).                                 |
| `npm test`                    | Plays headless games with your decks and scenarios (`mc-pack test .`).            |
| `npm run build`               | Builds the pack zip into `build/` and prints the app version it needs.            |
| `npm run describe`            | Drafts `pack.json`, `CREDITS.md`, `PERMISSION.md` and the registry file; lists TODOs. |
| `npm run agents:link`         | Recreates the agent links and the generated Codex agent files (see below).        |

## Save tokens: run the script first

Many tasks have a script that does the mechanical part and prints a compact result. **Run the skill's script first,
then use AI only for the remainder.** Do not re-derive what a script already printed, and do not paste raw command
output when a script summarizes it. Each skill's `SKILL.md` says exactly when to run its script and what to do after.

| Skill (`.agents/skills/<name>/`) | Script runs                                                    | You do after                                                  |
| ------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------- |
| `import-pack`                   | `mc-pack import-marvelcdb`, then validate; lists unscripted ids with card text | Script only the listed abilities; ask the creator the open items |
| `transcribe-cards`              | Lists pictures with no record; writes draft stubs (code, number, name) | Read each picture, fill its draft, ask about unclear fields |
| `find-precedent`                | Searches the game's card text and script index; prints top matches with file:line | Read one script, copy its shape, cite it                  |
| `script-card`                   | Lists unscripted abilities with card text and a suggested builder | Write each script from a precedent; report gaps            |
| `validate-and-fix`              | Runs validate + typecheck + test; prints one compact issue list with hints | Fix mechanical issues; report DSL gaps and author questions |
| `describe-pack`                 | `npm run describe --json`; prints facts and TODOs               | Ask the creator for the TODO facts, rerun with flags, proofread |
| `submit-pack`                   | Checks permission, TODOs, tag, release zip, build; writes `submission/<id>.yaml` | Tell the creator what only they can do; with their go-ahead, open the registry pull request |

## Subagents (`.agents/agents/`)

Small and focused. Use them proactively; each one starts with the matching skill's script.

| Agent               | Use when                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| `card-transcriber`  | There are card pictures or a card list but no card JSON, or a record is incomplete.              |
| `ability-scripter`  | Abilities are unscripted or a script does not match its text. Finds a precedent first, cites it. |
| `pack-validator`    | After any change, before committing, and when CI fails. Fixes mechanical issues, reports the rest. |
| `pack-describer`    | The cards are done and metadata, credits, permission or a `mod.json` mapping is needed.          |
| `rules-reader`      | A card's text reads two ways or a rules interpretation is about to be guessed. Read-only.        |

## Where things are

| Path                         | What                                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| `pack.json`                  | Pack id, version, kind, name, authors, description, languages, pictures, permission.           |
| `cards/<code>.json`          | One card record each. Codes: `x.<pack-id>.<NN>` with `a`/`b` for faces.                        |
| `abilities/index.ts`         | The pack's abilities: `export default definePackAbilities({ "<card code>.<slug>": ... })`.     |
| `decks/`, `encounter-sets/`, `scenarios/`, `campaigns/` | Precons and (for scenario packs) encounter content.              |
| `cards/<lang>/<code>.webp`, `art/` | Card faces (WebP, about 900 px long side) and full-bleed pictures.                       |
| `CREDITS.md`, `PERMISSION.md`| Required, not empty.                                                                           |
| `docs/card-json.md`          | Every card field by type, enums, codes, one example per type.                                   |
| `docs/dsl-reference.md`      | The DSL builders by group with examples. `docs/dsl-reference-generated.md` is the complete, generated list. |
| `docs/recipes.md`            | Common card text to script, each citing the base card it comes from.                           |
| `docs/finding-a-precedent.md`| Where base-game scripts are and how to search them.                                            |
| `docs/validation-errors.md`  | Every message `validate`, `typecheck` and `test` print, and the fix.                           |
| `docs/pack-metadata.md`      | `pack.json`, credits, permission, the registry file, and the `mod.json` mapping.               |
| `SAMPLE.md`                  | The sample hero: one card of each kind with the base card each script copies.                  |
| `SUBMITTING.md`              | The step-by-step guide from template to Mod Store, with a checklist and troubleshooting.       |

The game repo (https://github.com/quincarter/marvel-champions-digital-game) is the source of truth for the engine: card
schema in `packages/content/src/schema/cards/`, the DSL in `packages/cards/src/dsl/`, base-card scripts in
`packages/cards/src/`, worked packs in `content-packs/`.

## Conventions

- Ability ids are `<card code>.<slug>`; a face's ability uses the face's code (`x.my-hero.01b.quiet-study`). Every id in
  a card's `abilities` must be a key in `abilities/index.ts`.
- A script that names another card writes its exact printed name.
- Traits are upper case in JSON and in queries.
- Comments in scripts quote the card text and cite the base card copied; note a ruling or a reading the author chose.
- Keep `package-lock.json` committed: CI installs with `npm ci` and fails without it. The SDK is pinned to an exact
  version; upgrade it only on purpose (README, "Upgrading the SDK"). Tag releases `v<version>` matching `pack.json`.
- Do not commit `build/`, `.cache/`, `.drafts/` or `submission/` (git-ignored).

## Agent links on every system

The canonical files are `AGENTS.md`, `.agents/agents/*.md` and `.agents/skills/`. Each tool looks elsewhere, so these
paths are symlinks (committed as symlinks):

| Path                              | Points to              | Read by                  |
| --------------------------------- | ---------------------- | ------------------------ |
| `CLAUDE.md`                       | `AGENTS.md`            | Claude Code              |
| `GEMINI.md`                       | `AGENTS.md`            | Gemini CLI               |
| `.github/copilot-instructions.md` | `../AGENTS.md`         | GitHub Copilot           |
| `.claude/agents`                  | `../.agents/agents`    | Claude Code subagents    |
| `.claude/skills`                  | `../.agents/skills`    | Claude Code skills       |

Codex, Cursor, Windsurf and opencode read `AGENTS.md` directly, and Codex also reads `.agents/skills`. Codex subagents
are TOML: `.codex/agents/*.toml` is generated from `.agents/agents/*.md` by `npm run agents:link`; regenerate it after
editing an agent. On Windows without Developer Mode, git checks symlinks out as small text files: `npm run agents:link`
replaces them with real links where it can and with copies where it cannot (rerun it after editing a canonical file).
`npm run agents:link -- --check` exits 1 if anything is missing or out of date.

Edit only the canonical files, never the links.
