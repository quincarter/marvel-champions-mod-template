// First run: turns the sample pack into your own.
//
//   npm run init-pack -- --id my-hero --name "My Hero" --author "Your Name"
//
// Renames the pack id everywhere (card codes x.sample-hero.NN become x.my-hero.NN, the nemesis encounter set
// sample-hero-nemesis becomes my-hero-nemesis, and so do setCode, packCode and packCodes values and file names),
// names the nemesis set after the pack, sets the pack's name and author in pack.json, and resets its version to
// 0.1.0. The sample's cards stay as a starting point: edit them, delete what you don't need, and keep
// `npm run validate` passing.
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const args = Object.fromEntries(
  process.argv
    .slice(2)
    .join(" ")
    .split(/\s*--/)
    .filter(Boolean)
    .map((part) => {
      const [key, ...rest] = part.split(" ");
      return [key, rest.join(" ").replace(/^"|"$/g, "")];
    }),
);

const id = args.id;
if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
  console.error('Give a pack id of lowercase letters, digits and single dashes: npm run init-pack -- --id my-hero --name "My Hero"');
  process.exit(2);
}
const OLD_ID = "sample-hero";
const skip = new Set(["node_modules", ".git", "build", "scripts", ".github", "docs", ".agents", ".claude", ".codex", ".cache", ".drafts"]);
const textFile = /\.(json|ts|md|svg)$/;

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skip.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
    } else if (textFile.test(name) && name !== "package.json" && name !== "tsconfig.json") {
      const text = readFileSync(path, "utf8");
      // Card codes, `<id>-` prefixed ids (decks, the nemesis encounter set) and the bare id as a JSON string value
      // (cards' setCode and cycleId, a deck's packCode, an encounter set's packCodes).
      const next = text
        .replaceAll(`x.${OLD_ID}.`, `x.${id}.`)
        .replaceAll(`${OLD_ID}-`, `${id}-`)
        .replaceAll(`"${OLD_ID}"`, `"${id}"`);
      if (next !== text) writeFileSync(path, next);
    }
    if (name.includes(OLD_ID)) renameSync(path, join(dir, name.replaceAll(OLD_ID, id)));
  }
}
walk(".");

const pack = JSON.parse(readFileSync("pack.json", "utf8"));
pack.id = id;
pack.version = "0.1.0";
if (args.name) pack.name = args.name;
if (args.author) pack.authors = [args.author];
pack.description = args.description ?? `${pack.name}, a fan-made pack.`;
writeFileSync("pack.json", `${JSON.stringify(pack, null, 2)}\n`);

// The nemesis encounter set's display name follows the pack's.
if (args.name && existsSync("encounter-sets")) {
  for (const file of readdirSync("encounter-sets").filter((name) => name.endsWith(".json"))) {
    const path = join("encounter-sets", file);
    const set = JSON.parse(readFileSync(path, "utf8"));
    if (!set.nemesisOfIdentityId) continue;
    set.name = `${args.name} Nemesis`;
    writeFileSync(path, `${JSON.stringify(set, null, 2)}
`);
  }
}

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
pkg.name = id;
writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`Pack is now "${pack.name}" (${id}). Next: npm run validate, then edit cards/ and abilities/.`);
