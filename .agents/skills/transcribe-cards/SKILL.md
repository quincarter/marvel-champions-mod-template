---
name: transcribe-cards
description: Turn a folder of card pictures into card JSON records: a script lists the pictures with no record and writes draft stubs from the file names, then you fill each draft by reading its picture. Use when the creator has card images (or a card list) and cards/ is missing records.
---

# Transcribe cards from pictures

The script does the bookkeeping (codes, numbers, names, copying WebP pictures). You read the pictures.

## 1. Run the script

Name the pictures `<number>[a|b]-<card name>.<ext>` (`02-rook.webp`, `01a-sample-sentinel.png`, `01b-sam-pell.png`).

```bash
node .agents/skills/transcribe-cards/scripts/stubs.mjs <images-dir>                 # dry run: what needs a record
node .agents/skills/transcribe-cards/scripts/stubs.mjs <images-dir> --lang en --write
```

With `--write` it creates `.drafts/cards/<code>.json` (never in `cards/`, so validate keeps passing) with the code,
number, set, `quantityInSet` and name filled and everything else marked `TODO`, and copies `.webp` pictures to
`cards/<lang>/<code>.webp`. It lists pictures that need converting to WebP.

## 2. What you do after

1. For each draft, open the picture and fill the record from what is printed. The fields for each card type, the
   keyword shapes and an example are in `docs/card-json.md`. Use the card-transcriber agent for many cards.
2. Copy the printed text exactly into both `text.printed` and `text.current`.
3. List each ability the card's text needs in `abilities` by id (`<card code>.<slug>`), one per timing word. Do not
   script them here.
4. Anything you cannot read with certainty (a blurry number, an ambiguous symbol, text that reads two ways) goes
   into a question for the author with your best reading as the default. Never guess silently and never leave `TODO`
   in a record under `cards/`.
5. Remove `_todo`, move the finished record from `.drafts/cards/` to `cards/`, and add what the card needs
   elsewhere: a hero's obligation card and nemesis cards with their `encounter-sets/<id>.json`.
6. Run the validate-and-fix skill (use `npm run validate -- --allow-unscripted` while abilities are unwritten).
