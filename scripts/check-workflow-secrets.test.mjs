// node --test scripts/check-workflow-secrets.test.mjs (npm run test:scripts). No workflow job both runs pack code and
// holds a secret, and no privileged job checks out, installs or runs the pack.
import assert from "node:assert/strict";
import fs from "node:fs";
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

  /** A privileged release job with `steps` after download-artifact. */
  const release = (...steps) =>
    workflow(
      [
        "  release:",
        "    permissions:",
        "      contents: write",
        "    env:",
        "      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}",
        "    steps:",
        "      - uses: actions/download-artifact@v4",
        ...steps,
      ].join("\n"),
    );

  it("flags a privileged job that fetches a script from the tagged commit through the API and runs it", () => {
    // The release job as it was before the pinned action (PR #1 review): no checkout, but the tag's own script ran.
    const text = release(
      "      - run: |",
      '          gh api -H "Accept: application/vnd.github.raw" \\',
      '            "repos/${GH_REPO}/contents/scripts/release-assets.mjs?ref=${GITHUB_SHA}" > "$RUNNER_TEMP/r.mjs"',
      '      - run: node "$RUNNER_TEMP/r.mjs" "$GITHUB_REF_NAME" dist',
    );
    assert.deepEqual(checkWorkflow(text), ["release: holds a secret or write permission and runs a script fetched from a repo"]);
  });

  it("flags a raw URL piped into a shell, and git show of a script then run", () => {
    const raw = release(
      "      - run: curl -fsSL https://raw.githubusercontent.com/o/r/${GITHUB_SHA}/scripts/release.sh | bash",
    );
    assert.deepEqual(checkWorkflow(raw), ["release: holds a secret or write permission and runs a script fetched from a repo"]);
    const show = release(
      "      - run: git fetch --depth 1 origin $GITHUB_SHA && git show FETCH_HEAD:scripts/r.mjs > r.mjs",
      "      - run: node r.mjs",
    );
    assert.deepEqual(checkWorkflow(show), ["release: holds a secret or write permission and runs a script fetched from a repo"]);
  });

  it("passes a privileged job that reads a repo file through the API without running anything", () => {
    const text = release('      - run: gh api "repos/$GH_REPO/contents/pack.json?ref=$GITHUB_SHA" --jq .sha');
    assert.deepEqual(checkWorkflow(text), []);
  });

  it("flags a local action and an unpinned third-party action in a privileged job, and passes a full-SHA pin", () => {
    const text = release(
      "      - uses: ./.github/actions/release-assets",
      "      - uses: quincarter/marvel-champions-mod-template/.github/actions/release-assets@main",
      "      - uses: someone/action@v1",
      "      - uses: quincarter/marvel-champions-mod-template/.github/actions/release-assets@0123456789abcdef0123456789abcdef01234567",
    );
    assert.deepEqual(checkWorkflow(text), [
      "release: holds a secret or write permission and runs the local action ./.github/actions/release-assets",
      "release: holds a secret or write permission and uses quincarter/marvel-champions-mod-template/.github/actions/release-assets@main, not pinned to a full commit SHA",
      "release: holds a secret or write permission and uses someone/action@v1, not pinned to a full commit SHA",
    ]);
  });

  it("this repo's release job runs the template's release action pinned to a full commit SHA", () => {
    const job = splitJobs(fs.readFileSync(path.join(workflows, "ci.yml"), "utf8")).find((j) => j.name === "release");
    assert.match(job.body, /uses: quincarter\/marvel-champions-mod-template\/\.github\/actions\/release-assets@[0-9a-f]{40}\n/);
    assert.doesNotMatch(job.body, /\brun:/);
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
