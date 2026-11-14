// node --test scripts/release-assets.test.mjs (npm run test:scripts), on the release action's script in
// .github/actions/release-assets. The release job can be rerun: it creates a missing release, uploads missing files,
// skips identical ones and refuses to replace a different one.
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { attach, releaseFiles, viewRelease } from "../.github/actions/release-assets/release-assets.mjs";

const TAG = "v1.0.0";
const ZIP = "sample-hero-1.0.0.zip";
const work = mkdtempSync(path.join(tmpdir(), "release-assets-test-"));
after(() => rmSync(work, { recursive: true, force: true }));

/** A built dist/ with a zip and pack.json. */
function dist(zip = "zip bytes", pack = '{"version":"1.0.0"}') {
  const dir = mkdtempSync(path.join(work, "dist-"));
  writeFileSync(path.join(dir, ZIP), zip);
  writeFileSync(path.join(dir, "pack.json"), pack);
  return dir;
}

/** A fake gh over one release: `release` is null or `{ isDraft, assets: { name: contents } }`. Records each call. */
function fakeGh(release) {
  const calls = [];
  const ok = (stdout = "") => ({ status: 0, stdout, stderr: "" });
  const gh = (args) => {
    calls.push(args);
    const [, verb, tag] = args;
    assert.equal(tag, TAG);
    if (verb === "view") {
      if (release === null) return { status: 1, stdout: "", stderr: "release not found\n" };
      return ok(JSON.stringify({ isDraft: release.isDraft, assets: Object.keys(release.assets).map((name) => ({ name })) }));
    }
    if (verb === "download") {
      const name = args[args.indexOf("--pattern") + 1];
      writeFileSync(path.join(args[args.indexOf("--dir") + 1], name), release.assets[name]);
      return ok();
    }
    return ok();
  };
  return { gh, calls, verbs: () => calls.map((args) => args[1]) };
}

describe("attach", () => {
  it("creates a missing release with both files", () => {
    const fake = fakeGh(null);
    const actions = attach(TAG, releaseFiles(dist()), fake);
    assert.deepEqual(fake.verbs(), ["view", "create"]);
    assert.deepEqual(fake.calls[1].slice(3).map((arg) => path.basename(arg)), [
      ZIP,
      "pack.json",
      "--title",
      TAG,
      "--generate-notes",
      "--verify-tag",
    ]);
    assert.deepEqual(actions, [`created ${TAG} with ${ZIP}, pack.json`]);
  });

  it("uploads the zip to a release that lacks it, and checks the pack.json it has", () => {
    const fake = fakeGh({ isDraft: false, assets: { "pack.json": '{"version":"1.0.0"}' } });
    const actions = attach(TAG, releaseFiles(dist()), fake);
    assert.deepEqual(fake.verbs(), ["view", "upload", "download"]);
    assert.equal(path.basename(fake.calls[1][3]), ZIP);
    assert.equal(fake.calls[2][fake.calls[2].indexOf("--pattern") + 1], "pack.json");
    assert.equal(actions[0], `uploaded ${ZIP}`);
    assert.match(actions[1], /^pack\.json already attached, same sha256 [0-9a-f]{64}$/);
  });

  it("skips files already attached with the same SHA-256, and publishes a draft left behind", () => {
    const fake = fakeGh({ isDraft: true, assets: { [ZIP]: "zip bytes", "pack.json": '{"version":"1.0.0"}' } });
    const actions = attach(TAG, releaseFiles(dist()), fake);
    assert.deepEqual(fake.verbs(), ["view", "download", "download", "edit"]);
    assert.deepEqual(fake.calls.at(-1), ["release", "edit", TAG, "--draft=false"]);
    assert.equal(actions.length, 3);
    assert.match(actions[0], new RegExp(`^${ZIP.replaceAll(".", "\\.")} already attached`));
    assert.equal(actions[2], `published the draft ${TAG}`);
  });

  it("fails when the attached zip differs from the one built, and uploads nothing", () => {
    const fake = fakeGh({ isDraft: false, assets: { [ZIP]: "other bytes" } });
    assert.throws(() => attach(TAG, releaseFiles(dist()), fake), /already has a sample-hero-1\.0\.0\.zip that differs/);
    assert.deepEqual(fake.verbs(), ["view", "download"]);
  });

  it("fails when gh fails for any reason but a missing release", () => {
    const gh = () => ({ status: 1, stdout: "", stderr: "HTTP 401: Bad credentials" });
    assert.throws(() => viewRelease(TAG, gh), /gh release view v1\.0\.0 failed \(exit 1\): HTTP 401/);
  });
});

describe("releaseFiles", () => {
  it("wants exactly one zip and a pack.json", () => {
    const dir = mkdtempSync(path.join(work, "bad-"));
    writeFileSync(path.join(dir, "pack.json"), "{}");
    assert.throws(() => releaseFiles(dir), /expected one \.zip/);
    writeFileSync(path.join(dir, "a.zip"), "");
    writeFileSync(path.join(dir, "b.zip"), "");
    assert.throws(() => releaseFiles(dir), /found 2/);
  });
});
