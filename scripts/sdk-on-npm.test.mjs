// node --test scripts/sdk-on-npm.test.mjs (npm run test:scripts). Only a clean npm answer decides whether the pinned
// SDK is published; an outage or an auth error fails.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyNpmView, pinnedVersion, sdkOnNpm, SDK } from "./sdk-on-npm.mjs";

const E404 = [
  "npm error code E404",
  "npm error 404 Not Found - GET https://registry.npmjs.org/@champions-digital-game%2fmod-sdk - Not found",
].join("\n");

describe("classifyNpmView", () => {
  it("reads the version npm prints as published", () => {
    assert.equal(classifyNpmView({ status: 0, stdout: "0.44.0\n" }, "0.44.0"), "published");
  });

  it("reads a 404 as unpublished, for a missing package or a missing version", () => {
    assert.equal(classifyNpmView({ status: 1, stderr: E404 }, "0.44.0"), "unpublished");
    assert.equal(classifyNpmView({ status: 1, stderr: "npm ERR! code E404\nnpm ERR! 404 No match" }, "0.44.0"), "unpublished");
  });

  it("reads an empty answer (exit 0) as unpublished", () => {
    assert.equal(classifyNpmView({ status: 0, stdout: "" }, "0.44.0"), "unpublished");
  });

  it("fails on a network error, an auth error or a 403", () => {
    for (const stderr of [
      "npm error code ENOTFOUND\nnpm error network request to https://registry.npmjs.org failed",
      "npm error code ETIMEDOUT",
      "npm error code E401\nnpm error 401 Unauthorized",
      "npm error code E403\nnpm error 403 Forbidden",
      "npm error code E500\nnpm error 500 Internal Server Error - GET https://registry.npmjs.org/x - E404 in body",
    ]) {
      assert.throws(() => classifyNpmView({ status: 1, stderr }, "0.44.0"), /npm view failed/);
    }
  });

  it("fails when npm answers a different version", () => {
    assert.throws(() => classifyNpmView({ status: 0, stdout: "0.45.0" }, "0.44.0"), /not 0.44.0/);
  });
});

describe("sdkOnNpm", () => {
  it("asks npm for exactly the pinned version", () => {
    const calls = [];
    const run = (args) => (calls.push(args), { status: 1, stdout: "", stderr: E404 });
    assert.equal(sdkOnNpm("0.44.0", run), "unpublished");
    assert.deepEqual(calls, [["view", `${SDK}@0.44.0`, "version"]]);
  });
});

describe("pinnedVersion", () => {
  it("wants an exact version", () => {
    assert.equal(pinnedVersion({ devDependencies: { [SDK]: "0.44.0" } }), "0.44.0");
    assert.throws(() => pinnedVersion({ devDependencies: { [SDK]: "^0.44.0" } }), /exact version/);
    assert.throws(() => pinnedVersion({}), /exact version/);
  });
});
