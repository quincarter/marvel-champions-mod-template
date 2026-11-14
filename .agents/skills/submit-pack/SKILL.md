---
name: submit-pack
description: Carry a finished pack to an opened Mod Store registry pull request - check it is ready (permission granted with evidence, no TODOs, clean tree, tag pushed and matching pack.json's version, release zip attached, build passes), write packs/<id>.yaml from pack.json and git, then fork the registry and open the pull request once the creator confirms. Use when the creator wants to publish, submit or update the pack.
---

# Submit the pack

Submission is a pull request to the registry, https://github.com/quincarter/marvel-champions-mods, that adds (or, for
an update, changes) `packs/<id>.yaml`. `SUBMITTING.md` steps 7 to 11 are the human version of this skill. Run the
scripts first; spend effort only on what they report.

## 1. Run the script

```bash
node .agents/skills/submit-pack/scripts/submit.mjs --tags hero,justice --summary "One line for the store list"
node .agents/skills/submit-pack/scripts/submit.mjs --skip-build    # faster, when the build already passed
```

`--tags` defaults to the pack's `kind`; `--summary` is optional (the store falls back to the first line of
`description`). The script checks:

- `pack.json` has no `TODO`, a semver `version`, and an id other than `sample-hero`; `CREDITS.md` and `PERMISSION.md`
  exist with no `TODO`; there is no `DRAFT` file;
- `pack.json` `permission`, by the SDK's own rules (`mc-pack validate --publish`): `by` is filled; `status` is
  `granted`; a granted one has `date` (YYYY-MM-DD), `evidence`, `scope` and `languages`; `languages` covers every
  language in `languages.available`;
- the git tree is clean; `origin` is a `https://github.com/<owner>/<repo>` repo; the tag `v<version>` exists locally
  and on origin, points at `HEAD`, and was not moved;
- if `gh` is signed in: the tag's GitHub release carries `<id>-<version>.zip` (otherwise it prints a note to check by
  hand);
- `mc-pack validate . --publish` passes: the command the registry runs on the tagged commit, from the SDK the
  pack's `package-lock.json` pins (it skips the permission check in a folder with a `DRAFT` file, which is why the
  script refuses a `DRAFT` first);
- `mc-pack build` succeeds (it prints the zip's sha256).

It exits 1 with a list of problems, or prints `Ready`, writes `submission/<id>.yaml` (git-ignored) and prints it. The
file's `commit` is the full sha the tag points at; `creator` is `pack.json`'s first author; `permission` is copied
from `pack.json`. Do not edit those by hand.

## 2. Fix what it lists

| Problem                                   | What to do                                                                                            |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `TODO` in `pack.json` / the markdown files | The describe-pack skill: ask the creator, rerun with flags.                                          |
| Anything about `permission`               | **Ask the creator** for who granted it, when, the evidence, the scope and the languages. Never invent any of it. Their answers go in with the describe-pack flags (`--permission-status granted --permission-by ... --permission-date ... --permission-evidence ... --permission-scope ... --permission-languages ...`). If they have no evidence, record `--permission-status pending --permission-note "..."` and stop here: the pack is not submitted. |
| `mc-pack build failed`                    | The validate-and-fix skill.                                                                           |
| Uncommitted changes                       | Tell the creator what changed; commit only when they ask.                                             |
| Tag missing, not on origin, or not `HEAD` | Tell the creator the commands (`git tag v1.0.0 && git push origin v1.0.0`), and run them only if they ask you to. If the tag already exists on an older commit, the version must be bumped: never move a pushed tag. |
| No release, or no zip on it               | The Pack workflow's tag run failed or is still running: `gh run list --workflow ci.yml --limit 5`, then `gh run view <id> --log-failed`. Fix the cause, then a new version and tag. Never attach a zip by hand. |

Rerun the script until it prints `Ready`.

## 3. Show the creator, then open the pull request

1. Show the creator the file from `submission/<id>.yaml` and the pull request text you will use (below). Say which
   registry branch and fork you will create. **Wait for an explicit yes.** Without one, stop and give them the file
   and `SUBMITTING.md` step 9.
2. With their yes, and `gh` signed in (`gh auth status`), from the folder **above** the pack repo:

   ```bash
   gh repo fork quincarter/marvel-champions-mods --clone   # once; reuses an existing fork
   cd marvel-champions-mods
   git fetch upstream && git switch -c add-<id>-<version> upstream/main
   cp ../<pack-repo>/submission/<id>.yaml packs/<id>.yaml
   git add packs/<id>.yaml
   git commit -m "Add <id> v<version>"          # an update: "Update <id> to v<version>"
   git push -u origin add-<id>-<version>
   gh pr create --repo quincarter/marvel-champions-mods --title "Add <id> v<version>" --body-file <body file>
   ```

   If `marvel-champions-mods` is already cloned there, `cd` into it instead of forking again. Commit as the creator's
   own git identity; add no assistant attribution lines.

3. The body follows the registry's `.github/PULL_REQUEST_TEMPLATE.md`. Fill every line from `pack.json`, the
   submission file and the creator's answers: pack id, repo and tag, what it adds, who made it, who granted
   permission and the evidence link, the languages it covers. Tick a checklist box only if you checked it (CI green
   at the tag, the commit is the tag's, credits and permission files filled). Leave unticked what only the creator
   can confirm (they read the cards and played the pack) and tell them.
4. Give the creator the pull request link. The registry's **Check submission** workflow runs next; read its result
   with `gh pr checks <number> --repo quincarter/marvel-champions-mods`, and for a failure
   `gh run view <run id> --repo quincarter/marvel-champions-mods --log-failed`. `SUBMITTING.md`'s Troubleshooting
   table maps each message to a fix. A fix to the pack means a new version, tag and submission file, pushed to the
   same branch.

## Updates and withdrawals

- **Update:** bump `version` in `pack.json`, commit, the creator tags and pushes, rerun this skill, and the pull
  request changes only `tag` and `commit` (and `permission` or `summary` if they changed). A published version is
  never replaced.
- **Withdraw:** a pull request that deletes `packs/<id>.yaml`, with the reason in its body. Only for the creator's own
  pack, and only when they ask.

## Never

- invent permission, a date, evidence, a scope or languages;
- push, tag, fork, open a pull request or comment on one without the creator's go-ahead;
- move a pushed tag, or upload or replace a release zip by hand;
- edit another pack's file in the registry, approve or merge a pull request, or run the registry's publish.
