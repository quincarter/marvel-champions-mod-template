#!/usr/bin/env node
/**
 * Is the SDK version package.json pins on npm? Prints `published` or `unpublished` and exits 0 only when npm gave a
 * clean answer: the version itself (published), or a 404 / an empty answer for a version the package lacks
 * (unpublished). Anything else (no network, a registry outage, an auth error, a 403) exits 1, so CI fails rather than
 * reading an outage as "not published yet" and quietly checking nothing.
 *
 * Usage: node scripts/sdk-on-npm.mjs   (from the pack's root)
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const SDK = "@champions-digital-game/mod-sdk";

/**
 * Reads one `npm view <name>@<version> version` result: `{ status, stdout, stderr }` from the process. Returns
 * `"published"` or `"unpublished"`, or throws with what npm said.
 */
export function classifyNpmView({ status, stdout = "", stderr = "" }, version) {
  const out = stdout.trim();
  if (status === 0) {
    // npm prints the matching version, or nothing (exit 0) for a version an existing package does not have.
    if (out === "") return "unpublished";
    if (out === version) return "published";
    throw new Error(`npm view answered ${JSON.stringify(out)}, not ${version}`);
  }
  if (/^npm (error|ERR!) code E404\b/m.test(stderr)) return "unpublished";
  throw new Error(`npm view failed (exit ${status}):\n${stderr.trim() || out}`);
}

/** The pinned SDK version in package.json's devDependencies (an exact x.y.z, as .npmrc's save-exact writes it). */
export function pinnedVersion(pkg) {
  const version = pkg.devDependencies?.[SDK];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version ?? "")) {
    throw new Error(`package.json must pin ${SDK} to an exact version, not ${JSON.stringify(version)}`);
  }
  return version;
}

/** `run(args)` runs npm with `args` and returns `{ status, stdout, stderr }`. */
export function sdkOnNpm(version, run) {
  return classifyNpmView(run(["view", `${SDK}@${version}`, "version"]), version);
}

// npm is npm.cmd on Windows, which needs a shell; the arguments here hold no spaces or shell characters.
const runNpm = (args) =>
  process.platform === "win32"
    ? spawnSync(["npm", ...args].join(" "), { encoding: "utf8", shell: true })
    : spawnSync("npm", args, { encoding: "utf8" });

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const version = pinnedVersion(JSON.parse(readFileSync("package.json", "utf8")));
    console.log(sdkOnNpm(version, runNpm));
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exit(1);
  }
}
