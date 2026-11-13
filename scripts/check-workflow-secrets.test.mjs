// node --test scripts/check-workflow-secrets.test.mjs (npm run test:scripts). No workflow job both runs pack code and
// holds a secret, and no privileged job checks out, installs or runs the pack.
import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { checkWorkflow, checkWorkflows, splitJobs } from "./check-workflow-secrets.mjs";

const workflows = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".github", "workflows");

describe("this repo's workflows", () => {
  const results = checkWorkflows(workflows);
  const byFile = Object.fromEntries(results.map((r) => [r.file, r]));

  it("run pack code only in jobs without secrets, write permissions or a kept token", () => {
    assert.deepEqual(
      results.flatMap((r) => r.problems.map((p) => `${r.file}: ${p}`)),
      [],
    );
  });

  it("run pack code in check, sample and build, never in release", () => {
    assert.deepEqual(byFile["ci.yml"].packCodeJobs, ["check", "sample", "build"]);
  });
});

describe("checkWorkflow", () => {
  const workflow = (jobs) => `name: x\non: push\njobs:\n${jobs}`;

  it("flags a job that runs mc-pack with a secret, a write permission and a kept token", () => {
    const text = workflow(
      [
        "  release:",
        "    runs-on: ubuntu-latest",
        "    environment: store",
        "    permissions:",
        "      contents: write",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - run: npx --no-install mc-pack build . --out build",
        "        env:",
        "          GH_TOKEN: ${{ github.token }}",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), [
      "release: runs pack code and references secrets",
      "release: runs pack code in a deployment environment",
      "release: runs pack code with a write permission",
      "release: runs pack code after a checkout that keeps its token",
    ]);
  });

  it("counts npm scripts that call mc-pack as pack code, and wants the job's own permissions", () => {
    const text = workflow(
      [
        "  check:",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "        with:",
        "          persist-credentials: false",
        "      - run: npm run validate",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), ["check: runs pack code without its own permissions"]);
  });

  it("flags a privileged job that checks out or installs, even without running mc-pack", () => {
    const text = workflow(
      [
        "  release:",
        "    permissions:",
        "      contents: write",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - run: npm ci --ignore-scripts",
        "      - run: gh release create v1 x.zip",
        "        env:",
        "          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), [
      "release: holds a secret or write permission and checks out the pack",
      "release: holds a secret or write permission and installs dependencies",
    ]);
  });

  it("passes a privileged job that only downloads an artifact and uploads it", () => {
    const text = workflow(
      [
        "  release:",
        "    permissions:",
        "      contents: write",
        "    steps:",
        "      - uses: actions/download-artifact@v4",
        "      - run: gh release create v1 dist/*.zip",
        "        env:",
        "          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), []);
  });

  it("reads a secret only inside ${{ }}, and npm run test:scripts as no pack code", () => {
    const text = workflow(
      [
        "  workflows:",
        "    permissions:",
        "      contents: read",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - run: node scripts/check-workflow-secrets.mjs",
        "      - run: npm run test:scripts",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), []);
    assert.deepEqual(checkWorkflows(workflows).find((r) => r.file === "ci.yml").packCodeJobs.includes("workflows"), false);
  });

  it("ignores comments", () => {
    const text = workflow(
      [
        "  lint:",
        "    # mc-pack is not run here",
        "    permissions:",
        "      contents: read",
        "    steps:",
        "      - run: echo hi",
      ].join("\n"),
    );
    assert.deepEqual(checkWorkflow(text), []);
    assert.deepEqual(
      splitJobs(text).map((j) => j.name),
      ["lint"],
    );
  });
});
