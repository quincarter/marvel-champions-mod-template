#!/usr/bin/env node
/**
 * Attaches a built pack (its zip and pack.json) to the GitHub release for a tag, and can be rerun: a rerun of the
 * release job after a partial failure finishes the job instead of failing on "release already exists".
 *
 *   - no release for the tag: create it with both files (gh creates it as a draft, uploads, then publishes);
 *   - a release: upload each file it lacks; for a file it already has, download it and compare SHA-256 with the one
 *     just built: equal is skipped, different fails (a release asset is never replaced, since the registry compares
 *     its own rebuild with the zip on the release);
 *   - a draft left by an interrupted create is published once every file is on it.
 *
 * Uses the gh CLI with GH_TOKEN and GH_REPO from the environment. Node built-ins only: the release job runs this
 * without installing anything. It runs as the composite action in this folder (action.yml), which every pack's release
 * job pins to a full commit SHA of the template repo; scripts/release-assets.test.mjs tests it.
 *
 * Usage: node release-assets.mjs <tag> <dir>   (dir holds the build's *.zip and pack.json)
 */
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const sha256 = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** The files to attach: the one zip and pack.json in `dir`. */
export function releaseFiles(dir) {
  const names = readdirSync(dir);
  const zips = names.filter((name) => name.endsWith(".zip"));
  if (zips.length !== 1) throw new Error(`expected one .zip in ${dir}, found ${zips.length}`);
  if (!names.includes("pack.json")) throw new Error(`no pack.json in ${dir}`);
  return [zips[0], "pack.json"].map((name) => path.join(dir, name));
}

function must(result, what) {
  if (result.status !== 0) throw new Error(`${what} failed (exit ${result.status}): ${result.stderr?.trim() ?? ""}`);
  return result;
}

/** The release for `tag` as `{ isDraft, assets: [names] }`, or null when there is none. */
export function viewRelease(tag, gh) {
  const result = gh(["release", "view", tag, "--json", "isDraft,assets"]);
  if (result.status !== 0) {
    if (/release not found/i.test(result.stderr ?? "")) return null;
    must(result, `gh release view ${tag}`);
  }
  const data = JSON.parse(result.stdout);
  return { isDraft: data.isDraft === true, assets: (data.assets ?? []).map((asset) => asset.name) };
}

/**
 * Makes the release for `tag` carry `files`. `gh(args)` runs the gh CLI and returns `{ status, stdout, stderr }`.
 * Returns what it did, one line per action; throws when an attached file differs from the one built.
 */
export function attach(tag, files, { gh, log = () => {} }) {
  const actions = [];
  const note = (line) => (actions.push(line), log(line));
  const release = viewRelease(tag, gh);
  if (release === null) {
    must(gh(["release", "create", tag, ...files, "--title", tag, "--generate-notes", "--verify-tag"]), "gh release create");
    note(`created ${tag} with ${files.map((f) => path.basename(f)).join(", ")}`);
    return actions;
  }
  for (const file of files) {
    const name = path.basename(file);
    if (!release.assets.includes(name)) {
      must(gh(["release", "upload", tag, file]), `gh release upload ${name}`);
      note(`uploaded ${name}`);
      continue;
    }
    const dir = mkdtempSync(path.join(tmpdir(), "release-asset-"));
    try {
      must(gh(["release", "download", tag, "--pattern", name, "--dir", dir]), `gh release download ${name}`);
      const attached = sha256(path.join(dir, name));
      const built = sha256(file);
      if (attached !== built) {
        throw new Error(
          `${tag} already has a ${name} that differs from this build (attached sha256 ${attached}, built ${built}). ` +
            "A release asset is never replaced: delete the release (or the asset) by hand if it is wrong, or tag a new version.",
        );
      }
      note(`${name} already attached, same sha256 ${built}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  if (release.isDraft) {
    must(gh(["release", "edit", tag, "--draft=false"]), "gh release edit --draft=false");
    note(`published the draft ${tag}`);
  }
  return actions;
}

const runGh = (args) => spawnSync("gh", args, { encoding: "utf8" });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [tag, dir] = process.argv.slice(2);
  if (!tag || !dir) {
    console.error("usage: node release-assets.mjs <tag> <dir>");
    process.exit(2);
  }
  try {
    attach(tag, releaseFiles(dir), { gh: runGh, log: (line) => console.log(line) });
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
