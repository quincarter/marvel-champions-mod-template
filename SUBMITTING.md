# Submitting to the Mod Store

The store lists only approved packs. Approval happens in the registry repo,
[marvel-champions-mods](https://github.com/quincarter/marvel-champions-mods).

1. **Make sure CI passes** on your repo: `validate`, `typecheck` and `test`.
2. **Record permission.** `PERMISSION.md` says who allows the store to distribute the pack. If you're submitting
   someone else's pack, link to where they gave permission. Packs without permission are never approved.
3. **Tag a release** whose name matches `pack.json`'s version, for example `v1.0.0`. CI builds the pack and attaches
   the zip and `pack.json` to the release.
4. **Open a pull request** on the registry that adds `packs/<your-pack-id>.yaml`:

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
   ```

   Get the full sha with `git rev-parse v1.0.0^{commit}`. `npm run describe` drafts this file for you into
   `submission/<your-pack-id>.yaml`, and the `submit-pack` skill (`.agents/skills/submit-pack`) checks the tag, the
   commit and the permission and prints the finished file.

5. The registry's CI rebuilds your pack from that commit and checks that it matches your release. The maintainer
   reviews and plays it. Once it's merged, the pack appears in the Mod Store.

To **update** a pack, bump `version` in `pack.json`, tag a new release, and open a pull request that changes `tag` and
`commit`. A published version is never replaced, so always use a new version number.
