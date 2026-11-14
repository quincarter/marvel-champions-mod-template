#!/usr/bin/env node
// Drafts the pack's metadata from what is in the repo: pack.json, CREDITS.md, PERMISSION.md and the registry
// submission file, leaving everything it cannot know (creator, permission, evidence) as clearly marked TODOs.
//
//   npm run describe                         print the drafts and the list of TODOs
//   npm run describe -- --json               the same as one JSON object (for a script or an assistant)
//   npm run describe -- --write              write pack.json, CREDITS.md, PERMISSION.md and submission/<id>.yaml
//
// Fill the TODOs with flags instead of editing by hand:
//   --creator "Name"  --permission-by "Name"  --permission-evidence "https://..."  --permission-date 2026-11-05
//   --permission-scope "inclusion and translation"  --permission-status granted|pending
//   --permission-languages en,es  --permission-note "what is still missing"  --template-credit "Hitch"  --translator es="Name"
//   --text-language en  --base-language es  --summary "One line for the store"  --repo https://github.com/you/pack
//   --tag v1.0.0  --app ">=0.1.0"  --mod path/to/mod.json
//
// If a BluefireF5ran-style `mod.json` is in the repo root (or given with --mod), its fields fill what is blank:
// author, template, version, permission {status, scope, date}, languages {base, <lang>: translator|"author"}, open.
// Existing values in pack.json win over everything except a TODO. See docs/pack-metadata.md.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const TODO = "TODO";
const argv = process.argv.slice(2);
const flags = new Map();
const translators = {};
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith("--")) continue;
  const name = a.slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith("--")) flags.set(name, true);
  else {
    if (name === "translator") {
      const eq = next.indexOf("=");
      if (eq > 0) translators[next.slice(0, eq)] = next.slice(eq + 1);
    } else flags.set(name, next);
    i++;
  }
}
const flag = (name) => (typeof flags.get(name) === "string" ? flags.get(name) : undefined);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const listJson = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .map((f) => readJson(join(dir, f)))
    : [];
const dirs = (dir) =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name) : [];
const files = (dir) =>
  existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => e.name) : [];
const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
};
const kebab = (s) =>
  String(s)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
const semverOf = (text) => {
  const m = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?![\d.])/.exec(text ?? "");
  return m ? `${m[1]}.${m[2] ?? "0"}.${m[3] ?? "0"}` : undefined;
};
// A YAML scalar: plain when that is safe, otherwise double-quoted (a JSON string is a valid YAML scalar).
const yamlScalar = (v) => {
  const s = String(v);
  const plain = /^[A-Za-z0-9_][A-Za-z0-9 _.,/@()+-]*$/.test(s) && !s.endsWith(" ");
  return plain && !/^(true|false|yes|no|on|off|null|~)$/i.test(s) ? s : JSON.stringify(s);
};
const isTodo = (v) => typeof v === "string" && v.includes(TODO);

// ---- Read the repo -------------------------------------------------------------------------------------------------
const existing = existsSync("pack.json") ? readJson("pack.json") : {};
const modPath = flag("mod") ?? (existsSync("mod.json") ? "mod.json" : undefined);
const mod = modPath && existsSync(modPath) ? readJson(modPath) : undefined;
const cards = listJson("cards");
const decks = listJson("decks");
const scenarios = listJson("scenarios");
const encounterSets = listJson("encounter-sets");
const campaigns = listJson("campaigns");
const todos = [];
const todo = (text) => todos.push(text);

const identities = cards.filter((c) => c.type === "hero_identity");
const byType = {};
for (const c of cards) byType[c.type] = (byType[c.type] ?? 0) + 1;

// ---- pack.json -----------------------------------------------------------------------------------------------------
const id = existing.id ?? (mod ? kebab(mod.id) : undefined) ?? TODO;
if (id === "sample-hero") todo("pack id is still sample-hero: run `npm run init-pack -- --id <your-id> --name \"<Your Name>\"` first");

const modKind = mod?.kind ? String(mod.kind).replace(/_pack$/, "") : undefined;
let kind = existing.kind ?? modKind;
if (!kind) {
  if (identities.length > 0) kind = "hero";
  else if (scenarios.length > 0) kind = "scenario";
  else if (campaigns.length > 0) kind = "campaign";
  else if (encounterSets.length > 0) kind = "modular";
  else if (dirs("alt-art").length > 0) kind = "art";
  else {
    kind = "hero";
    todo("kind could not be inferred (no hero identity, scenario, campaign, modular set or alt art): set it by hand");
  }
}

const sampleAuthor = "Marvel Champions Digital contributors";
const creator = flag("creator") ?? (existing.authors?.[0] && existing.authors[0] !== sampleAuthor ? existing.authors[0] : undefined) ?? mod?.author;
if (!creator) todo("authors: pass --creator \"Name\" (the person who made the cards)");
const authors = creator ? [creator] : [`${TODO}: the creator's name`];

const name = existing.name && existing.name !== "Sample Sentinel" ? existing.name : (mod?.name ?? identities[0]?.name ?? existing.name ?? `${TODO}: pack name`);

const version = existing.version ?? semverOf(mod?.version) ?? "0.1.0";
if (mod?.version && !semverOf(mod.version)) todo(`mod.json version "${mod.version}" is not semver: the pack uses ${version}`);

const heroNames = identities.map((c) => c.name);
let description = existing.description;
if (!description || /test hero|sample/i.test(description)) {
  const what = kind === "hero" && heroNames.length ? `: ${heroNames.join(", ")}` : `: ${name}`;
  description = `Fan-made ${kind} pack${creator ? ` by ${creator}` : ""}${what}.`;
  todo("description: a one-line draft was generated; improve it (it is the store's text, and its first line is the default summary)");
}

// Languages: pictures live in cards/<lang>/<code>.webp.
const pictureLangs = dirs("cards").filter((l) => /^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(l));
let languages;
if (pictureLangs.length > 0) {
  const base = flag("base-language") ?? existing.languages?.base ?? (mod?.languages?.base) ?? (pictureLangs.includes("en") ? "en" : pictureLangs[0]);
  const text = flag("text-language") ?? existing.languages?.text;
  languages = { base, available: [...new Set([base, ...pictureLangs])].sort() };
  if (text && text !== base) languages.text = text;
  const missing = cards.filter((c) => !existsSync(join("cards", base, `${c.id}.webp`)));
  if (missing.length > 0) todo(`${missing.length} card(s) have no cards/${base}/<code>.webp picture (${missing.slice(0, 5).map((c) => c.id).join(", ")}${missing.length > 5 ? ", ..." : ""})`);
} else {
  todo("no card pictures: add cards/<lang>/<card code>.webp (see the README, Images) so the pack shows card faces");
}

// Pictures (the hero select picture) and alternate art.
const pictures = existing.pictures ? structuredClone(existing.pictures) : {};
if (identities[0]) {
  const art = files("art").find((f) => /^hero\./.test(f));
  const ok = pictures.hero && Object.values(pictures.hero).every((p) => existsSync(p));
  if (art && !ok) pictures.hero = { [identities[0].id]: `art/${art}` };
  else if (!art && !ok) todo("pictures.hero: add art/hero.webp (the hero select picture) and map the identity code to it");
}
const altArt = {};
for (const lang of dirs("alt-art")) {
  for (const f of files(join("alt-art", lang)).filter((f) => f.endsWith(".webp")).sort()) {
    (altArt[lang] ??= {})[f.replace(/\.webp$/, "")] = `alt-art/${lang}/${f}`;
  }
}

// Permission and credits.
const modPerm = mod?.permission;
const granted = modPerm?.status === "granted";
const permissionBy = flag("permission-by") ?? existing.permission?.by ?? (granted ? mod?.author : undefined);
const permissionDate = flag("permission-date") ?? existing.permission?.date ?? modPerm?.date;
const permissionScope = flag("permission-scope") ?? existing.permission?.scope ?? modPerm?.scope;
const permissionEvidence = flag("permission-evidence") ?? existing.permission?.evidence;
// Status and languages are never assumed: `granted` comes from the flag, an existing pack.json or a granted mod.json.
const permissionStatus =
  flag("permission-status") ?? existing.permission?.status ?? (granted ? "granted" : modPerm ? "pending" : undefined);
const permissionLanguages = flag("permission-languages")
  ? flag("permission-languages").split(",").map((l) => l.trim()).filter(Boolean)
  : existing.permission?.languages;
const permissionNote = flag("permission-note") ?? existing.permission?.note;
if (modPerm && !granted) todo(`mod.json says permission status is "${modPerm.status ?? "none"}": do not submit this pack until it is granted`);
if (!permissionBy) todo("permission.by: who allows the store to distribute this pack (--permission-by); if you made it yourself, that is you");
if (!permissionDate) todo("permission.date: YYYY-MM-DD when permission was given (--permission-date)");
if (!permissionEvidence) todo("permission.evidence: a link or a quoted message showing permission (--permission-evidence); the registry review asks for it");
if (!permissionStatus) todo("permission.status: --permission-status granted once permission is given (pending until then); packs that are not granted are never approved");
else if (permissionStatus !== "granted" && permissionStatus !== "pending") todo(`permission.status is "${permissionStatus}": use --permission-status granted or --permission-status pending`);
else if (permissionStatus === "pending") todo(`permission.status is pending: do not submit this pack until it is granted${permissionNote ? ` (${permissionNote})` : ""}`);
if (!permissionScope) todo('permission.scope: how far the permission goes, for example "inclusion" or "inclusion and translation" (--permission-scope)');
{
  const shipped = languages?.available ?? [];
  if (!permissionLanguages) todo(`permission.languages: the languages the permission covers (--permission-languages ${shipped.join(",") || "en"}); a translation needs the creator's permission too`);
  else {
    const uncovered = shipped.filter((l) => !permissionLanguages.includes(l));
    if (uncovered.length > 0) todo(`permission.languages does not cover ${uncovered.join(", ")}, which the pack ships: get the creator's permission for them, or remove those pictures`);
  }
}
for (const open of mod?.open ?? []) todo(`open item from mod.json: ${open}`);
if (mod?.status && mod.status !== "ready") todo(`mod.json status is "${mod.status}"`);

const templateCredit = flag("template-credit") ?? existing.templateCredit ?? mod?.template;
const modTranslators = Object.fromEntries(Object.entries(mod?.languages ?? {}).filter(([l, w]) => l !== "base" && w !== "author" && /^[a-z]{2,3}$/.test(l)));
const allTranslators = { ...modTranslators, ...(existing.translators ?? {}), ...translators };

const packJson = {
  id,
  version,
  kind,
  name,
  authors,
  description,
  license: "Fan-made, non-commercial; see CREDITS.md",
  requires: existing.requires ?? { app: flag("app") ?? ">=0.1.0", packs: [] },
  ...(languages ? { languages } : {}),
  ...(Object.keys(pictures).length ? { pictures } : {}),
  ...(Object.keys(altArt).length ? { altArt } : {}),
  ...(permissionBy
    ? {
        permission: {
          ...(permissionStatus ? { status: permissionStatus } : {}),
          by: permissionBy,
          ...(permissionDate ? { date: permissionDate } : {}),
          ...(permissionEvidence ? { evidence: permissionEvidence } : {}),
          ...(permissionScope ? { scope: permissionScope } : {}),
          ...(permissionLanguages ? { languages: permissionLanguages } : {}),
          ...(permissionNote ? { note: permissionNote } : {}),
        },
      }
    : {}),
  ...(templateCredit ? { templateCredit } : {}),
  ...(Object.keys(allTranslators).length ? { translators: allTranslators } : {}),
};
if (flag("app")) packJson.requires = { ...packJson.requires, app: flag("app") };
todo("requires.app: `npm run build` prints the oldest app version the scripts need; set it if it is higher than the draft");

// ---- CREDITS.md and PERMISSION.md ----------------------------------------------------------------------------------
const credits = [
  "# Credits",
  "",
  `${name} (\`${id}\`) is a fan-made pack${creator ? ` by **${creator}**` : ` by ${TODO}: creator`}.`,
  "",
  `- Card design and art direction: ${creator ?? `${TODO}: creator`}.`,
  ...(templateCredit ? [`- Card template: ${templateCredit}.`] : []),
  ...Object.entries(allTranslators).map(([l, w]) => `- Translation (${l}): ${w}.`),
  ...(languages ? [`- Pictures: ${languages.available.join(", ")} (base language ${languages.base}).`] : []),
  `- ${TODO}: where the character art comes from (your own, commissioned, or Marvel comics art as used by the author), and any other contributor.`,
  `- Ability scripts: ${TODO}: who wrote them (you, or an assistant working from your card text).`,
  "",
  "Marvel Champions: The Card Game is the property of Fantasy Flight Games and Marvel.",
  "",
].join("\n");

const permissionLines = [
  "# Permission",
  "",
  permissionBy
    ? `${permissionBy} gives permission for ${name} to be distributed through the mod store.`
    : `${TODO}: who gives permission for ${name} to be distributed through the mod store.`,
  "",
  `- Status: ${permissionStatus ?? `${TODO}: granted | pending`}`,
  `- Scope: ${permissionScope ?? `${TODO}: for example "inclusion" or "inclusion and translation"`}`,
  `- Date: ${permissionDate ?? `${TODO}: YYYY-MM-DD`}`,
  `- Via: ${permissionEvidence ?? `${TODO}: a link or a quoted message showing it was given`}`,
  `- Languages: ${permissionLanguages?.join(", ") ?? `${TODO}: the languages it covers (the original and each translation)`}`,
  ...(permissionNote ? [`- Note: ${permissionNote}`] : []),
  "",
];
const permission = permissionLines.join("\n");

// ---- Registry submission -------------------------------------------------------------------------------------------
const remote = git("remote", "get-url", "origin")
  .replace(/^git@github\.com:/, "https://github.com/")
  .replace(/^ssh:\/\/git@github\.com\//, "https://github.com/")
  .replace(/\.git$/, "");
const tag = flag("tag") ?? `v${version}`;
const commit = git("rev-parse", `${tag}^{commit}`);
if (!remote && !flag("repo")) todo("registry repo: pass --repo https://github.com/<you>/<pack-repo> (no git origin found)");
if (!commit) todo(`registry commit: tag ${tag} does not exist yet; after tagging run \`git rev-parse ${tag}^{commit}\``);
const registry = [
  `id: ${id}`,
  `repo: ${flag("repo") ?? (remote || `${TODO}: https://github.com/<you>/<pack-repo>`)}`,
  `tag: ${tag}`,
  `commit: ${commit || `${TODO}: git rev-parse ${tag}^{commit}`}`,
  `creator: ${creator ? yamlScalar(creator) : `${TODO}: creator`}`,
  "permission:",
  `  by: ${permissionBy ? yamlScalar(permissionBy) : `${TODO}: who granted permission`}`,
  `  evidence: ${permissionEvidence ? yamlScalar(permissionEvidence) : `${TODO}: a link to where permission was given`}`,
  `  date: ${permissionDate ?? `${TODO}: YYYY-MM-DD`}`,
  `tags: [${kind}]`,
  ...(flag("summary") ? [`summary: ${yamlScalar(flag("summary"))}`] : []),
  "",
].join("\n");

// ---- Output --------------------------------------------------------------------------------------------------------
const facts = {
  cards: cards.length,
  byType,
  identities: heroNames,
  decks: decks.map((d) => d.id),
  scenarios: scenarios.map((s) => s.id),
  encounterSets: encounterSets.map((s) => s.id),
  campaigns: campaigns.map((c) => c.id),
  pictureLanguages: pictureLangs,
  modJson: modPath ?? null,
};
const result = { facts, files: { "pack.json": `${JSON.stringify(packJson, null, 2)}\n`, "CREDITS.md": credits, "PERMISSION.md": permission, [`submission/${id}.yaml`]: registry }, todos };

if (flags.get("json")) {
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
} else {
  console.log(`Pack ${id}@${version} (${kind}): ${cards.length} cards, ${decks.length} deck(s), ${scenarios.length} scenario(s), ${encounterSets.length} encounter set(s)${modPath ? `; read ${modPath}` : ""}`);
  for (const [path, text] of Object.entries(result.files)) console.log(`\n=== ${path} ===\n${text.replace(/\n$/, "")}`);
  console.log(`\n=== TODO (${todos.length}) ===`);
  for (const t of todos) console.log(`- ${t}`);
}

if (flags.get("write")) {
  const force = flags.get("force") === true;
  const placeholder = (path) =>
    !existsSync(path) || force || /TODO|sample pack|Sample Sentinel/.test(readFileSync(path, "utf8"));
  if (result.files["pack.json"].includes(TODO)) {
    console.error("not writing pack.json: it would contain a TODO placeholder. Pass --creator \"Name\" (and --name via pack.json) first.");
    process.exitCode = 2;
  } else writeFileSync("pack.json", result.files["pack.json"]);
  for (const path of ["CREDITS.md", "PERMISSION.md"]) {
    if (placeholder(path)) writeFileSync(path, result.files[path]);
    else console.error(`kept your ${path} (it has no TODO or sample text; pass --force to replace it)`);
  }
  mkdirSync("submission", { recursive: true });
  writeFileSync(`submission/${id}.yaml`, registry);
  console.error(`wrote pack.json, CREDITS.md, PERMISSION.md and submission/${id}.yaml; ${todos.length} TODO(s) remain`);
}
