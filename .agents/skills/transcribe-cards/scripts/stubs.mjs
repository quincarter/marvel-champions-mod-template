#!/usr/bin/env node
// Lists the card pictures that have no card record yet and writes draft stubs for them, with the code, number and name
// taken from the file names, so the assistant only reads each picture for the rest.
//
//   node .agents/skills/transcribe-cards/scripts/stubs.mjs <images-dir> [--lang en] [--write]
//
// File names: `<number>[a|b]-<card name>.<ext>`, for example `02-rook.webp`, `01a-sample-sentinel.png`,
// `01b-sam-pell.png` (a hero's two faces are one record, `01a`; the `b` picture is only copied). A name with no number
// is numbered after the highest number in use. Without --write nothing is changed. With --write, stubs go to
// `.drafts/cards/<code>.json` (never to cards/, so `npm run validate` is not broken by unfinished records) and
// .webp pictures are copied to `cards/<lang>/<code>.webp`; other formats are listed for conversion.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";
import { readJson } from "../../../../scripts/lib/pack-cards.mjs";

const argv = process.argv.slice(2);
const dir = argv.find((a, i) => !a.startsWith("--") && argv[i - 1] !== "--lang");
const lang = argv.includes("--lang") ? argv[argv.indexOf("--lang") + 1] : "en";
const write = argv.includes("--write");
if (!dir || !existsSync(dir)) {
  console.error("usage: stubs.mjs <images-dir> [--lang en] [--write]");
  process.exit(2);
}

const pack = readJson("pack.json");
const packId = pack.id;
const existing = new Set(existsSync("cards") ? readdirSync("cards").filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")) : []);
const drafts = new Set(existsSync(join(".drafts", "cards")) ? readdirSync(join(".drafts", "cards")).map((f) => f.replace(/\.json$/, "")) : []);
const used = [...existing, ...drafts].map((c) => Number(/\.(\d+)[a-z]?$/.exec(c)?.[1] ?? 0));

const titleCase = (s) => s.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b[a-z]/g, (c) => c.toUpperCase());
const images = readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f)).sort();
const NAMED = /^(\d{1,3})([a-c])?[-_. ]+(.+)$/;
const fileNumbers = images.map((f) => NAMED.exec(f.replace(/\.[^.]+$/, ""))).filter(Boolean).map((m) => Number(m[1]));
let next = Math.max(0, ...used, ...fileNumbers) + 1;
const rows = [];
for (const file of images) {
  const base = file.replace(/\.[^.]+$/, "");
  const m = /^(\d{1,3})([a-c])?[-_. ]+(.+)$/.exec(base);
  const number = m ? Number(m[1]) : next++;
  const face = m?.[2] ?? "";
  const name = titleCase(m ? m[3] : base);
  const nn = String(number).padStart(2, "0");
  const code = `x.${packId}.${nn}${face}`;
  const recordCode = `x.${packId}.${nn}${face === "b" ? "a" : face}`;
  rows.push({ file, code, recordCode, name, face, number });
}

console.log(`${images.length} picture(s) in ${dir}:`);
for (const r of rows) {
  const has = existing.has(r.recordCode) || (r.face === "b" && existing.has(`x.${packId}.${String(r.number).padStart(2, "0")}a`));
  const status = has ? "has a card record" : drafts.has(r.recordCode) ? "has a draft" : "NEEDS a record";
  console.log(`- ${r.file} -> ${r.code} "${r.name}": ${status}`);
}

if (!write) {
  console.log("\nDry run. Pass --write to create drafts in .drafts/cards/ and copy .webp pictures.");
  process.exit(0);
}
mkdirSync(join(".drafts", "cards"), { recursive: true });
mkdirSync(join("cards", lang), { recursive: true });
const toConvert = [];
for (const r of rows) {
  const draftPath = join(".drafts", "cards", `${r.recordCode}.json`);
  if (r.face !== "b" && !existing.has(r.recordCode) && !existsSync(draftPath)) {
    const text = { printed: "TODO: copy the printed text", current: "TODO: same as printed" };
    const stub = {
      id: r.recordCode,
      type: "TODO: one of hero_identity, ally, event, support, upgrade, resource, player_side_scheme, villain, minion, attachment, main_scheme, side_scheme, treachery, obligation, environment",
      name: r.name,
      setCode: packId,
      cycleId: packId,
      collectorNumber: String(r.number),
      quantityInSet: 1,
      unique: false,
      text,
      traits: [],
      keywords: [],
      abilities: [],
      _todo: `Fill every field from the picture ${r.file} (see docs/card-json.md for the fields of the card's type), delete this _todo and move the file to cards/.`,
    };
    writeFileSync(draftPath, `${JSON.stringify(stub, null, 2)}\n`);
  }
  if (extname(r.file).toLowerCase() === ".webp") {
    const target = join("cards", lang, `${r.code}.webp`);
    if (!existsSync(target)) copyFileSync(join(dir, r.file), target);
  }
  else toConvert.push(r.file);
}
console.log(`\nwrote drafts to .drafts/cards/ and copied .webp pictures to cards/${lang}/.`);
if (toConvert.length > 0) console.log(`Convert to WebP (about 900 px long side, quality ~85) and save as cards/${lang}/<code>.webp: ${toConvert.join(", ")}`);
console.log("Next: read each picture and fill its draft (the card-transcriber agent does this), then move it to cards/.");
