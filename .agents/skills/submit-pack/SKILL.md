---
name: submit-pack
description: Check a finished pack is ready for the Mod Store (no TODOs, permission recorded, clean tree, tag pushed and matching pack.json's version, build passes) and print the registry file with the real commit. Use when the creator wants to publish or submit the pack.
---

# Submit the pack

Submission is a pull request to the registry; the script checks everything that can be checked and prints the file.

## 1. Run the script

```bash
node .agents/skills/submit-pack/scripts/submit.mjs            # checks + build
node .agents/skills/submit-pack/scripts/submit.mjs --skip-build
```

It checks: `pack.json` has no `TODO` and a semver version; `CREDITS.md` and `PERMISSION.md` exist with no `TODO` and
permission is granted; `pack.json` has `permission.by`, `evidence` and `date`; the git tree is clean; `origin` exists;
the tag `v<version>` exists locally and on origin and points at HEAD; `mc-pack build` succeeds. If anything fails it
prints a list and exits 1. If all pass it prints `packs/<id>.yaml` with the full commit sha and the build's zip hash.

## 2. What you do after

1. For each listed problem, fix it (describe-pack for TODOs and permission, validate-and-fix for build errors) or tell
   the creator what only they can do: commit, tag (`git tag v1.0.0 && git push origin v1.0.0`), push.
2. Once it prints "Ready", give the creator the file and the steps in `SUBMITTING.md`: add it as `packs/<id>.yaml` in
   the registry repo (https://github.com/quincarter/marvel-champions-mods) and open a pull request. The registry's CI
   rebuilds the pack from that commit; the maintainer reviews and plays it.
3. To update a published pack: bump `version` in `pack.json`, commit, tag the new version, rerun this script, and open a
   pull request changing `tag` and `commit`. A published version is never replaced.

Never open the registry pull request for the creator without their say-so, and never submit a pack without recorded
permission.
