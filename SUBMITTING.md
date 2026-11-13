# Making a pack and submitting it to the Mod Store

This is the whole path, from an empty repo to a pack players can install from **Extras ▸ Mod Store** in the
[Marvel Champions digital game](https://github.com/quincarter/marvel-champions-digital-game). Follow the steps in
order. Every command runs from your pack repo's root folder unless a step says otherwise.

Two repos are involved:

- **your pack repo**, made from this template. It holds your cards, scripts, pictures and metadata, and its CI builds
  the release zip;
- **the registry**, [quincarter/marvel-champions-mods](https://github.com/quincarter/marvel-champions-mods). It holds
  one small file per approved pack. You submit by opening a pull request there; merging it publishes the pack.

Using an AI assistant? Read [Using an AI assistant](#using-an-ai-assistant) at the end first: it lists the skills
that do most of these steps for you.

## Contents

- [Before you start](#before-you-start)
- [Create your repo](#1-create-your-repo)
- [Install and lock the SDK](#2-install-and-lock-the-sdk)
- [Name your pack](#3-name-your-pack)
- [Make the cards](#4-make-the-cards)
- [Check the pack](#5-check-the-pack)
- [Describe the pack](#6-describe-the-pack)
- [Record permission](#7-record-permission)
- [Push, then tag a release](#8-push-then-tag-a-release)
- [Open the registry pull request](#9-open-the-registry-pull-request)
- [Read the registry's check](#10-read-the-registrys-check)
- [Review, merge and publish](#11-review-merge-and-publish)
- [Updating a pack](#updating-a-pack)
- [Withdrawing a pack](#withdrawing-a-pack)
- [What a pack cannot do](#what-a-pack-cannot-do)
- [Troubleshooting](#troubleshooting)
- [Using an AI assistant](#using-an-ai-assistant)

## Before you start

You need:

- a GitHub account;
- [git](https://git-scm.com/downloads);
- [Node.js](https://nodejs.org/) 24 (the version CI uses), which includes `npm`;
- optional but useful: the [GitHub CLI](https://cli.github.com/) (`gh`), signed in with `gh auth login`. The
  commands below that start with `gh` can also be done on github.com.

**What a pack is.** A pack is data: card records (JSON), ability scripts written with the game's ability DSL, decks,
scenarios and pictures. Its `pack.json` `kind` says what it adds:

| `kind`       | What it adds                                                                      |
| ------------ | --------------------------------------------------------------------------------- |
| `hero`       | A hero: identity, signature cards, nemesis set and obligation, and a precon deck. |
| `scenario`   | A villain, main scheme and encounter sets.                                        |
| `modular`    | Encounter sets only.                                                              |
| `campaign`   | Campaigns over scenarios (linear, data only; see the game repo's design doc).     |
| `art`        | Alternate art for base-game cards or the pack's own.                              |
| `house-rule` | A house rule, such as traits added to official cards. Coming in a game release; until your SDK knows the kind, `validate` refuses it. |

**Permission comes first.** The store only lists packs whose creator gave permission for the store to distribute
them. If you made the pack, that is you. If you are submitting someone else's pack, you need their permission, and a
link or a quoted message that shows it, before you start step 7. **Packs without permission evidence are never
approved.**

## 1. Create your repo

1. On [this template's page](https://github.com/quincarter/marvel-champions-mod-template), click **Use this template
   ▸ Create a new repository**. Make it **public**: the registry builds your pack from it.
2. Clone it:

   ```bash
   git clone https://github.com/<you>/<your-pack-repo>.git
   cd <your-pack-repo>
   ```

## 2. Install and lock the SDK

```bash
npm install
git add package-lock.json
git commit -m "Lock the SDK"
```

`npm install` installs the game's SDK (`@champions-digital-game/mod-sdk`, which gives you the `mc-pack` tool) at the
exact version `package.json` pins, and writes `package-lock.json`. **Commit the lockfile.** CI installs with
`npm ci`, which fails without it, and the registry rebuilds your pack with exactly the SDK the lockfile names. To move
to a newer SDK later, see the README's "Upgrading the SDK".

## 3. Name your pack

```bash
npm run init-pack -- --id my-hero --name "My Hero" --author "Your Name"
```

This turns the sample hero into your pack: it renames the card codes (`x.sample-hero.01a` becomes `x.my-hero.01a`),
the nemesis set and the files, sets the name and author in `pack.json`, and resets the version to `0.1.0`.

The **pack id** (`--id`) is lowercase letters, digits and single dashes, for example `my-hero` or `spider-ham-jd`. It
prefixes every card code and names the registry file. **Never change it after your first release**: players' saves
and installs refer to it.

Commit the result:

```bash
git add -A
git commit -m "Start my-hero from the template"
```

## 4. Make the cards

Edit, add or delete files in these folders. The sample cards stay as examples until you replace them.

| Path                                    | What goes there                                                            | Guide                                          |
| --------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------- |
| `cards/<code>.json`                     | One record per card (`a`/`b` codes for the two faces).                     | [docs/card-json.md](docs/card-json.md)         |
| `abilities/index.ts`                    | Every ability a card names, written with the DSL.                          | [docs/recipes.md](docs/recipes.md), [docs/dsl-reference.md](docs/dsl-reference.md), [docs/finding-a-precedent.md](docs/finding-a-precedent.md) |
| `decks/<pack-id>-*.json`                | Precon decks (may list base-game card codes).                              | [SAMPLE.md](SAMPLE.md)                         |
| `encounter-sets/`, `scenarios/`, `campaigns/` | Encounter content, for nemesis sets and scenario packs.              | [docs/card-json.md](docs/card-json.md)         |
| `cards/<lang>/<code>.webp`              | Card faces per language (`en`, `es`, ...). WebP, about 900 px long side.   | README, "Images"                               |
| `art/`                                  | Full-bleed pictures, such as the hero select picture.                      | README, "Images"                               |

Already have the cards in MarvelCDB's JSON format (a community `mod.json` folder)? Convert them instead of typing
them:

```bash
npx mc-pack import-marvelcdb <folder> --out .
```

It writes the card records, renumbers the codes, and writes an `abilities/index.ts` that lists every ability still to
script. An imported pack's permission starts as `pending`; step 7 settles it.

Script every ability. Copy the shape of a base-game card that does the same thing and name it in a comment. If no DSL
builder can express a card's text, the game's engine lacks that mechanic: leave the ability unscripted and ask (see
[What a pack cannot do](#what-a-pack-cannot-do)). Do not script something close to it.

## 5. Check the pack

Run these as you work, and all four before every release:

```bash
npm run validate     # schema, card codes, abilities, files, credits, engine features used
npm run typecheck    # your ability scripts
npm test             # plays headless games with your precon (or your scenario)
npm run build        # builds build/<pack-id>-<version>.zip and prints the oldest game version it needs
```

All four must pass. An unscripted ability is a failure. Every message they print, and its fix, is in
[docs/validation-errors.md](docs/validation-errors.md). `build/` is git-ignored: never commit it, and never upload a
zip you built yourself (step 8 explains why).

## 6. Describe the pack

When the cards are done, draft the metadata from them:

```bash
npm run describe
```

It prints drafts of `pack.json`, `CREDITS.md`, `PERMISSION.md` and the registry file, then a **TODO** list of the
facts only you know. Answer them with flags and write the files:

```bash
npm run describe -- --creator "Your Name" \
  --permission-status granted --permission-by "Your Name" --permission-date 2026-11-11 \
  --permission-evidence "I made this pack myself" --permission-scope inclusion --permission-languages en \
  --summary "One line for the store list" --write
```

Then:

- improve the generated `description` in `pack.json` (the store shows it);
- replace every `TODO:` line left in `CREDITS.md` (where the art comes from, who wrote the scripts);
- if `npm run build` printed a minimum game version higher than `requires.app`, set `requires.app` to it.

Every flag is explained in [docs/pack-metadata.md](docs/pack-metadata.md). Run `npm run validate` again afterwards.

## 7. Record permission

`pack.json` must say, in its `permission` block, that the creator granted the store permission to distribute the
pack, and show where. `PERMISSION.md` says the same in words. Step 6's flags write both; the result looks like this:

```json
"permission": {
  "status": "granted",
  "by": "Your Name",
  "date": "2026-11-11",
  "evidence": "I made this pack myself",
  "scope": "inclusion",
  "languages": ["en"]
}
```

| Field       | What to write                                                                                                 |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| `status`    | `granted` once permission is given. `pending` until then (and the pack is not submitted).                     |
| `by`        | Who gave it: the creator, or the person who granted it on their behalf.                                       |
| `date`      | When it was given, `YYYY-MM-DD`.                                                                              |
| `evidence`  | If you made the pack: a sentence saying so. Otherwise: a link to the post or message where the creator granted it, or the quoted message and where it is kept. |
| `scope`     | How far it goes, for example `inclusion` or `inclusion and translation`.                                      |
| `languages` | The languages it covers: the original's and each translation's. It must include every language the pack ships pictures for (`languages.available`): a translation needs the creator's permission too. |
| `note`      | Only while `pending`: what is still missing.                                                                  |

Check it the way the store will:

```bash
npx mc-pack validate . --publish
```

It fails unless `status` is `granted` and `languages` covers every shipped language. (If it answers
`unknown option --publish`, your SDK predates that check; the submit script in step 9 checks the same rule.)

Never fill these fields with permission nobody gave. A maintainer reads the evidence before approving, and a pack
without it is closed, not merged.

Commit:

```bash
git add -A
git commit -m "Metadata and permission"
```

## 8. Push, then tag a release

1. Push, and wait for CI:

   ```bash
   git push
   ```

   Open your repo's **Actions** tab. The **Pack** workflow's **check** job runs `validate`, `typecheck` and `test`
   with `npm ci`, and **Workflow safety** checks the workflow file itself. Both must be green. Fix any failure
   ([Troubleshooting](#troubleshooting)) and push again.

2. Go through this checklist:

   - [ ] `npm run validate`, `npm run typecheck`, `npm test` and `npm run build` pass locally.
   - [ ] `npx mc-pack validate . --publish` passes (or, on an older SDK, the permission block is `granted` with
         every field filled).
   - [ ] `package-lock.json` is committed.
   - [ ] `pack.json` has no `TODO`; `CREDITS.md` and `PERMISSION.md` have no `TODO` line.
   - [ ] `pack.json`'s `version` is a version you have never released (the first release can stay `0.1.0`, or
         use `1.0.0`).
   - [ ] There is no `DRAFT` file in the repo root.
   - [ ] `git status` shows nothing to commit, and the CI run on your last push is green.

3. Tag the commit with `v` plus `pack.json`'s version, and push the tag:

   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

   The tag starts the Pack workflow again. Its **Build the release zip** job builds the pack with the locked SDK and
   fails if the tag does not match `pack.json`'s version; then the **release** job creates a GitHub release named
   after the tag with two files attached: `<pack-id>-<version>.zip` and `pack.json`. Check the release appears under
   **Releases** on your repo before going on.

**Never move or re-push a released tag, and never replace the release's zip by hand.** The registry rebuilds your
pack from the tagged commit and requires the release zip to be byte for byte the same. To change anything, bump the
version and tag again.

## 9. Open the registry pull request

1. Write the registry file. The submit script checks everything that can be checked (no TODOs, permission granted
   and covering every language, clean tree, tag on origin pointing at `HEAD`, the release has the zip, the build
   passes) and writes `submission/<pack-id>.yaml`:

   ```bash
   node .agents/skills/submit-pack/scripts/submit.mjs --tags hero,justice --summary "One line for the store list"
   ```

   Fix whatever it lists and run it again until it prints `Ready`. The file it writes looks like this:

   ```yaml
   id: my-hero
   repo: https://github.com/<you>/<your-pack-repo>
   tag: v1.0.0
   commit: 0123456789abcdef0123456789abcdef01234567
   creator: Your Name
   permission:
     by: Your Name
     evidence: I made this pack myself
     date: 2026-11-11
   tags: [hero, justice]
   summary: One line for the store list
   ```

   | Field        | Rule                                                                                             |
   | ------------ | ------------------------------------------------------------------------------------------------ |
   | `id`         | `pack.json`'s `id`. The file must be named `packs/<id>.yaml`.                                    |
   | `repo`       | `https://github.com/<owner>/<repo>`, public.                                                     |
   | `tag`        | The release tag, `v<version>`.                                                                   |
   | `commit`     | The full 40-character sha the tag points at: `git rev-parse v1.0.0^{commit}`.                    |
   | `creator`    | The pack's creator, as the store shows it.                                                       |
   | `permission` | `by`, `evidence` and `date`, the same as `pack.json`'s.                                          |
   | `tags`       | The pack's kind first, then anything that helps players find it (an aspect, a team).             |
   | `summary`    | Optional. One line for the store list; without it the store uses the first line of `description`. |

2. Add it to the registry in a pull request. With `gh` (from the folder that holds your pack repo, not inside it):

   ```bash
   gh repo fork quincarter/marvel-champions-mods --clone
   cd marvel-champions-mods
   git switch -c add-my-hero
   cp ../<your-pack-repo>/submission/my-hero.yaml packs/my-hero.yaml
   git add packs/my-hero.yaml
   git commit -m "Add my-hero v1.0.0"
   git push -u origin add-my-hero
   gh pr create --repo quincarter/marvel-champions-mods --web
   ```

   `--web` opens the pull request form in your browser with the registry's template. Fill in every line of it,
   including where the permission was given, and submit.

   Without `gh`: on the registry's page click **Fork**, then in your fork open `packs/`, choose **Add file ▸ Create
   new file**, name it `my-hero.yaml`, paste the file, commit it to a new branch and click **Compare & pull request**.

The registry's own guide, [CONTRIBUTING.md](https://github.com/quincarter/marvel-champions-mods/blob/main/CONTRIBUTING.md),
has the same fields and what its reviewers look at.

## 10. Read the registry's check

The pull request starts the registry's **Check submission** workflow. For your file it:

1. checks the file's fields, that `tag` points at `commit` in your repo, and downloads `<pack-id>-<version>.zip` from
   your release;
2. checks out your repo at `commit` (not the tag), runs `npm ci`, `mc-pack validate`, `mc-pack test` and
   `mc-pack build`;
3. compares the zip it built with the one on your release, byte for byte.

When it passes, open the run (the **Details** link next to the check on the pull request) and its **Summary** page:
it lists the pack's version, size, zip sha256, the oldest game version it needs, the packs it needs, the number of
card pictures, the permission, and the engine features it uses. **All checks** is the result the maintainer needs.

If it fails, the failing step's log names the problem (see [Troubleshooting](#troubleshooting)). Fix it in your pack
repo, bump `version` in `pack.json`, commit, push, tag the new version (step 8), run the submit script again and
push the new `tag` and `commit` to the same pull request branch:

```bash
cp ../<your-pack-repo>/submission/my-hero.yaml packs/my-hero.yaml
git commit -am "my-hero v1.0.1"
git push
```

A failure in the registry file alone (a typo in a field) needs only a fixed file, not a new release.

## 11. Review, merge and publish

A maintainer then:

- reads the permission evidence and checks it covers every language the pack ships;
- reads the cards and their scripts against their text;
- plays the pack;
- checks its size and the engine features it uses.

They may ask for changes in the pull request. Merging it approves the pack. The registry's publish workflow then
uploads the zip and its preview to the store and lists the pack in the store's catalog; it shows up in **Extras ▸
Mod Store** the next time the game loads the catalog.

## Updating a pack

1. Change the pack, run step 5's checks, and **bump `version` in `pack.json`** (`1.0.0` to `1.0.1` for fixes, `1.1.0`
   for new cards).
2. Commit, push, wait for green CI, then tag and push the new version (step 8).
3. Run the submit script (step 9), and open a pull request on the registry that changes only `tag` and `commit` in
   `packs/<pack-id>.yaml` (and `permission` or `summary`, if they changed).

**Versions are immutable.** A published version is never replaced: the store keeps older versions so games saved
with them still load, and a publish that finds the same version with a different zip fails. Always use a new version
number.

## Withdrawing a pack

Open a pull request on the registry that deletes `packs/<pack-id>.yaml`, and say why in it. Once merged, the store
stops offering the pack. Players who installed it keep their copy, marked withdrawn, so their saves still load.
Adding the file back later lists the pack again.

## What a pack cannot do

A pack ships data, never code. `abilities/index.ts` runs once when the pack is built, and the game only ever reads
the JSON it produces. So a card can only do what the game's engine already supports.

- If a card needs a new keyword, timing, effect or rule, the game has to add it in a release first. Ask in the
  [custom content discussion](https://github.com/quincarter/marvel-champions-digital-game/issues/488), with the card
  and its text. A pack that needs it can't be approved until that release.
- `npm run validate` lists the engine features the pack uses and fails on one the SDK's engine lacks. Upgrading the
  SDK (README, "Upgrading the SDK") picks up features from newer game releases.
- No sideloading: the store only installs approved packs.

## Troubleshooting

| What you see                                                                                       | Where              | Fix                                                                                                                       |
| -------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `No package-lock.json. Run npm install once, commit the package-lock.json ...`                      | Pack CI, check     | `npm install`, then commit `package-lock.json` and push.                                                                  |
| `npm ci` says `package.json and package-lock.json ... are not in sync`                             | Pack CI or registry | You changed `package.json` without reinstalling. Run `npm install`, commit both files.                                    |
| `mc-pack validate` or `mc-pack test` fails                                                          | Pack CI or registry | Run the same command locally; [docs/validation-errors.md](docs/validation-errors.md) has every message.                  |
| `tag v1.0.1 but pack.json says 1.0.0`                                                               | Pack CI, build     | The tag must be `v` + `pack.json`'s version. Bump the version, commit, and tag that version (don't reuse the wrong tag).  |
| `Commit package-lock.json before tagging a release.`                                                | Pack CI, build     | Commit the lockfile, then tag a new version.                                                                              |
| The **release** job fails or stops partway                                                           | Pack CI, release   | Re-run the failed jobs: the job creates the release only if it is missing and uploads only the files it lacks.            |
| `v1.0.0 already has a <id>-1.0.0.zip that differs from this build`                                   | Pack CI, release   | The release holds a different zip (attached by hand, or built from other code). Tag a new version; or, if the release is wrong and nobody uses it, delete the asset and re-run. |
| `check-workflow-secrets` fails                                                                      | Pack CI, Workflow safety | You changed `.github/workflows/ci.yml` so a job that runs pack code can reach a secret or a write token. Undo that change. |
| `the file name must be <id>.yaml`, `id must be lowercase letters, digits and single dashes`        | Registry check     | Name the file `packs/<id>.yaml` with `pack.json`'s id.                                                                    |
| `commit must be a full 40-character sha`                                                            | Registry check     | Use `git rev-parse v1.0.0^{commit}`, not a short sha.                                                                     |
| `repo must be a https://github.com/<owner>/<repo> address`                                          | Registry check     | No `.git` suffix, no trailing slash, no `git@` address.                                                                   |
| `tag v1.0.0 points at <sha>, not <commit>` (or `at nothing`)                                        | Registry check     | The tag isn't pushed (`git push origin v1.0.0`), or `commit` is wrong, or the tag was moved. Fix `commit`; if you moved the tag, tag a new version. |
| `could not download <id>-<version>.zip from the v1.0.0 release ...`                                 | Registry check     | The release doesn't exist or lacks the zip: the Pack workflow's build or release job failed. Fix it, then tag a new version. |
| `the release's zip (...) differs from the rebuilt one (...)`                                        | Registry check     | The zip on the release was not built by CI from that commit with the locked SDK (replaced by hand, or `package-lock.json` changed after the tag). Let CI build it: tag a new version. |
| `pack.json's id is X, not Y`                                                                        | Registry check     | The registry file's `id` must equal `pack.json`'s `id` at that commit.                                                    |
| `.creator is missing` (or `.permission.by`, `.permission.evidence`, `.permission.date`)            | Registry check     | Add that field to the registry file.                                                                                      |
| `<id> is already in index.json from another publisher ...` (after merge)                           | Registry publish   | The game's own repo already publishes that pack id. Talk to the maintainer: a pack id has one publisher.                 |

## Using an AI assistant

`AGENTS.md` is the instruction file every assistant reads (`CLAUDE.md`, `GEMINI.md` and
`.github/copilot-instructions.md` point to it). The skills in `.agents/skills/` run a script first and use the AI only
for what is left. Use them in this order:

| Step | Skill                                    | What it does                                                                                       |
| ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 4    | `import-pack` or `transcribe-cards`      | Imports a MarvelCDB-format folder, or turns card pictures into card records.                       |
| 4    | `find-precedent`, then `script-card`     | Finds the base-game card that does the same thing, then scripts each unscripted ability from it.   |
| 5    | `validate-and-fix`                       | Runs validate, typecheck and test; fixes the mechanical problems; reports DSL gaps and questions. |
| 6–7  | `describe-pack`                          | Drafts the metadata and asks you for the facts it can't know, including the permission evidence.   |
| 8–9  | `submit-pack`                            | Checks the pack is ready, writes the registry file, and opens the registry pull request once you say so. |

The assistant asks you for anything only you know: the creator, the permission and its evidence, unclear card text.
It never invents permission or evidence, and it does not tag, push or open the registry pull request without your
go-ahead. You still read the cards and play the pack before submitting: the maintainer will.
