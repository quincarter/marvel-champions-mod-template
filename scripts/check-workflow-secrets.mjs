#!/usr/bin/env node
/**
 * Checks that no GitHub Actions job both runs pack code and holds a secret. `mc-pack validate`, `test` and `build`
 * import the pack's abilities/index.ts, which runs whatever is in it (a pull request can change it), so a job that
 * runs them must have no secret, no deployment `environment`, no write permission, its own `permissions:` block and
 * no persisted checkout token. A privileged job (one that references a secret or `github.token`, or has a write
 * permission) must not check the pack out, install dependencies (an install can run a lifecycle script) or run pack
 * code: it only moves what an unprivileged job built. Nor may it run a script fetched from a repo without a checkout
 * (the contents API, a raw URL, git): that is the release candidate's code too. What it runs comes from a GitHub-owned
 * action (`actions/`, `github/`) or an action pinned to a full commit SHA, such as the template's release-assets action;
 * a local action (`uses: ./...`) or a third-party one at a tag or branch is a problem.
 *
 * Adapted from the game repo's scripts/check-workflow-secrets.mjs, which guards the same split in the game's and the
 * registry's workflows. This copy also counts `github.token` as a secret and checkouts in privileged jobs as a problem.
 *
 * Usage: node scripts/check-workflow-secrets.mjs [workflows dir]   (exit 1 with the problems listed)
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** What marks a job as running pack code: the SDK's CLI, and the npm scripts and repo scripts that call it. */
export const PACK_CODE =
  /\bmc-pack\b|\bnpm\s+(run\s+)?(validate|test|build|init-pack)(?![\w:-])|\bsubmit-contract\.sh\b|\bsubmit-pack\/scripts\/submit\.mjs\b/;
const INSTALL = /\b(pnpm|npm|yarn)\s+(install|ci|i)\b/;
/** A secret or the job's token, inside a `${{ }}` expression (so a file name like check-workflow-secrets.mjs is not). */
const SECRET = /\$\{\{[^}]*\b(secrets\.|github\.token\b)/;
const WRITE = /^\s+[\w-]+:\s*write\b/m;
const CHECKOUT = /uses: actions\/checkout@/g;
/**
 * Fetching a file of a repo at some ref without a checkout: the contents API (`gh api`, curl or wget), a raw URL, or
 * git itself. In a privileged job, followed by running a script, that runs the release candidate's code with the token.
 */
export const FETCH_REPO_FILE =
  /\bgh\s+api\b[^\n]*\/contents\/|raw\.githubusercontent\.com|\b(curl|wget)\b[^\n]*\/(contents|raw)\/|\bgit\s+(clone|fetch|archive|show|cat-file)\b/;
/** Running a script file with an interpreter, or piping something into a shell. */
export const RUN_SCRIPT =
  /\b(node|bash|sh|zsh|python3?|deno|bun|pwsh|perl|ruby|npx|tsx|source)[ \t]+["'$\w./~-]|\|\s*(ba|z)?sh\b/;
/** Every `uses:` reference in a job: `[ref, ...]`. */
const usesOf = (body) => [...body.matchAll(/^\s*(?:-\s+)?uses:\s*["']?([^\s"'#]+)/gm)].map((m) => m[1]);
/** Actions published by GitHub itself, trusted at a major-version tag. */
const GITHUB_OWNED = /^(actions|github)\//;

/**
 * Splits a workflow's `jobs:` block into jobs by indentation, which is all this check needs (no YAML parser: the
 * script runs with Node built-ins only). Comment lines are dropped. Returns `[{ name, body }]`.
 */
export function splitJobs(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((line) => /^jobs:\s*$/.test(line));
  if (start < 0) return [];
  const jobs = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break;
    if (/^\s*#/.test(line)) continue;
    const head = /^ {2}([\w-]+):\s*$/.exec(line);
    if (head) jobs.push({ name: head[1], lines: [] });
    else if (jobs.length > 0) jobs.at(-1).lines.push(line);
  }
  return jobs.map(({ name, lines: body }) => ({ name, body: body.join("\n") }));
}

/** The problems in one workflow's text, as `<job>: <problem>` lines. */
export function checkWorkflow(text, { packCode = PACK_CODE } = {}) {
  const problems = [];
  for (const job of splitJobs(text)) {
    const checkouts = job.body.match(CHECKOUT)?.length ?? 0;
    if (packCode.test(job.body)) {
      if (SECRET.test(job.body)) problems.push(`${job.name}: runs pack code and references secrets`);
      if (/^\s+environment:/m.test(job.body)) problems.push(`${job.name}: runs pack code in a deployment environment`);
      if (WRITE.test(job.body)) problems.push(`${job.name}: runs pack code with a write permission`);
      if (!/^\s+permissions:/m.test(job.body)) problems.push(`${job.name}: runs pack code without its own permissions`);
      const unpersisted = job.body.match(/persist-credentials: false/g)?.length ?? 0;
      if (checkouts > unpersisted) problems.push(`${job.name}: runs pack code after a checkout that keeps its token`);
    } else if (SECRET.test(job.body) || WRITE.test(job.body)) {
      if (checkouts > 0) problems.push(`${job.name}: holds a secret or write permission and checks out the pack`);
      if (INSTALL.test(job.body)) problems.push(`${job.name}: holds a secret or write permission and installs dependencies`);
      // A shell command continued over lines with a trailing backslash reads as one line.
      const joined = job.body.replace(/\\\r?\n\s*/g, " ");
      if (FETCH_REPO_FILE.test(joined) && RUN_SCRIPT.test(joined))
        problems.push(`${job.name}: holds a secret or write permission and runs a script fetched from a repo`);
      for (const ref of usesOf(job.body)) {
        if (ref.startsWith("./")) problems.push(`${job.name}: holds a secret or write permission and runs the local action ${ref}`);
        else if (!GITHUB_OWNED.test(ref) && !/@([0-9a-f]{40}|sha256:[0-9a-f]{64})$/.test(ref))
          problems.push(`${job.name}: holds a secret or write permission and uses ${ref}, not pinned to a full commit SHA`);
      }
    }
  }
  return problems;
}

/** Every workflow under `dir`: `{ file, problems, packCodeJobs }`. */
export function checkWorkflows(dir, options) {
  const packCode = options?.packCode ?? PACK_CODE;
  return fs
    .readdirSync(dir)
    .filter((file) => /\.ya?ml$/.test(file))
    .sort()
    .map((file) => {
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      return {
        file,
        problems: checkWorkflow(text, options),
        packCodeJobs: splitJobs(text)
          .filter((job) => packCode.test(job.body))
          .map((job) => job.name),
      };
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dir = process.argv[2] ?? path.join(".github", "workflows");
  const results = checkWorkflows(dir);
  const problems = results.flatMap(({ file, problems: list }) => list.map((p) => `${file}: ${p}`));
  for (const { file, packCodeJobs } of results) {
    if (packCodeJobs.length > 0) console.log(`${file}: pack code runs in ${packCodeJobs.join(", ")}`);
  }
  if (problems.length > 0) {
    for (const problem of problems) console.error(`::error::${problem}`);
    process.exit(1);
  }
  console.log("No job that runs pack code holds a secret, and no privileged job checks out, installs or runs code from the repo.");
}
