---
name: import-pack
description: Convert a MarvelCDB-shaped community pack folder (mod.json, cards JSON, images/) into this repo with `mc-pack import-marvelcdb`, then list only the abilities still to script. Use when the creator has a community pack folder to bring in, or says "import this pack".
---

# Import a community pack

The SDK's importer does the mechanical conversion (card codes, references, pictures, `pack.json`, `CREDITS.md`,
`PERMISSION.md`, an `abilities/index.ts` stub). Run the script; do not convert cards by hand.

## 1. Run the script

```bash
node .agents/skills/import-pack/scripts/import.mjs <path-to-pack-folder> [--id <pack-id>]
```

Add `--dry` first to preview without writing anything. The script:

1. runs `mc-pack import-marvelcdb <folder> --out . [--id <pack-id>]`, which renumbers codes to `x.<pack-id>.<NN>[a|b]`
   and rewrites every reference;
2. runs `mc-pack validate . --allow-unscripted`;
3. prints the importer's notes (open items, a missing permission date, a guessed version), the real problems, and the
   list of abilities still to script, each with its card and printed text.

It never overwrites an existing `abilities/index.ts` (it holds the author's scripts).

## 2. What you do after

1. **Problems** the script lists (not the unscripted list): fix them with `docs/validation-errors.md`. Common:
   an unusable pack id (pass `--id`), a card the normalizer rejected.
2. **Unscripted abilities**: script only the ones listed, with the script-card skill (it finds precedents). Do not
   rescan or retranscribe the cards: the importer already did.
3. **Notes**: each `open:` note and a missing permission date is a question for the creator. Put them to the creator
   in one batch; do not answer them yourself. A permission that is not `granted` means the pack must not be
   submitted (say so).
4. **Metadata**: run the describe-pack skill to review `pack.json`, `CREDITS.md` and `PERMISSION.md`
   (`docs/pack-metadata.md` explains the `mod.json` mapping).
5. Finish with the validate-and-fix skill.

If the importer says the folder has no `mod.json` or no card data file, the folder is not a MarvelCDB-shaped pack:
use the transcribe-cards skill with the card pictures instead.
