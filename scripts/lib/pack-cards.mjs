// Shared helpers for the skills' scripts (.agents/skills/*/scripts): read the pack's cards, map each ability id to the
// card text it implements, list the ids already scripted, and run mc-pack. Plain Node, no dependencies.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

export function readCards(root = ".") {
  const dir = join(root, "cards");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson(join(dir, f)));
}

/**
 * Every ability id a card lists, with where it is and the printed text next to it:
 * `Map<abilityId, { card, name, type, where, text }>`. `where` says which face or stage carries it.
 */
export function abilityIndex(cards) {
  const index = new Map();
  const add = (card, where, refs, text) => {
    for (const ref of refs ?? []) index.set(ref.id, { card: card.id, name: card.name, type: card.type, where, text: text ?? "" });
  };
  for (const card of cards) {
    if (card.type === "hero_identity") {
      add(card, "hero face", card.hero?.abilities, card.hero?.text?.current);
      add(card, "alter-ego face", card.alterEgo?.abilities, card.alterEgo?.text?.current);
      for (const form of card.additionalHeroForms ?? []) add(card, `form ${form.faceName}`, form.abilities, form.text?.current);
    } else if (card.type === "villain") {
      for (const side of card.sides ?? []) for (const stage of side.stages ?? []) add(card, `side ${side.side} stage ${stage.stageNumber}`, stage.abilities, stage.text?.current);
    } else if (card.type === "main_scheme") {
      for (const stage of card.stages ?? []) {
        add(card, `stage ${stage.stageNumber} (B side)`, stage.abilities, stage.text?.current);
        add(card, `stage ${stage.stageNumber} (A side)`, stage.aSide?.abilities, stage.aSide?.text?.current);
      }
    } else {
      add(card, "card", card.abilities, card.text?.current);
      if (card.flipSide) add(card, "flip side", card.flipSide.abilities, card.flipSide.text?.current);
    }
  }
  return index;
}

/** The ability ids `abilities/index.ts` defines (its keys), found by text, so the file need not be loaded. */
export function scriptedIds(root = ".") {
  const path = join(root, "abilities", "index.ts");
  if (!existsSync(path)) return new Set();
  const text = readFileSync(path, "utf8");
  return new Set([...text.matchAll(/^\s*"(x\.[a-z0-9-]+\.\d+[a-z]?\.[a-z0-9-]+)"\s*:/gm)].map((m) => m[1]));
}

/**
 * Runs an installed tool (`mc-pack` from the SDK, or `tsc`) with the current Node, with no shell and no npx, so it works
 * the same on every OS; returns { status, stdout, stderr }.
 */
export function run(bin, args, options = {}) {
  const sdk = join("node_modules", "@champions-digital-game", "mod-sdk");
  let entry;
  if (bin === "mc-pack") {
    const pkg = existsSync(join(sdk, "package.json")) ? readJson(join(sdk, "package.json")) : undefined;
    const rel = typeof pkg?.bin === "string" ? pkg.bin : pkg?.bin?.["mc-pack"];
    entry = rel ? join(sdk, rel) : undefined;
  } else if (bin === "tsc") entry = join("node_modules", "typescript", "bin", "tsc");
  if (!entry || !existsSync(entry)) {
    return { status: 1, stdout: "", stderr: `${bin} is not installed: run \`npm install\` first` };
  }
  const result = spawnSync(process.execPath, [entry, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options });
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** Parses `mc-pack validate` output into { defects, unscripted, summary }. */
export function parseValidate(output) {
  const defects = [];
  const unscripted = [];
  let group;
  for (const line of output.split(/\r?\n/)) {
    if (/^\d+ problems?:/.test(line)) group = defects;
    else if (/^\d+ unscripted abilit/.test(line)) group = unscripted;
    else if (group && /^ {2}\S/.test(line)) {
      const m = /^ {2}(.+?): (.*)$/.exec(line);
      if (m) group.push({ path: m[1], message: m[2] });
    }
  }
  return { defects, unscripted, summary: output.split(/\r?\n/).find((l) => /@\S+: (valid|invalid)/.test(l)) ?? "" };
}

/** The ability id inside an unscripted-ability message: `ability "<id>" is defined by neither ...`. */
export const unscriptedId = (issue) => /ability "([^"]+)"/.exec(issue.message)?.[1];

export const clip = (s, n) => {
  const one = String(s).replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n - 1)}…` : one;
};
