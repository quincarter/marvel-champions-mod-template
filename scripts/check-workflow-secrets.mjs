#!/usr/bin/env node
/**
 * Checks that no GitHub Actions job both runs pack code and holds a secret. `mc-pack validate`, `test` and `build`
 * import the pack's abilities/index.ts, which runs whatever is in it (a pull request can change it), so a job that
 * runs them must have no secret, no deployment `environment`, no write permission, its own `permissions:` block and
 * no persisted checkout token. A privileged job (one that references a secret or `github.token`, or has a write
 * permission) must not check the pack out, install dependencies (an install can run a lifecycle script) or run pack
 * code: it only moves what an unprivileged job built.
 *
 * Adapted from the game repo's scripts/check-workflow-secrets.mjs, which guards the same split in the game's and the
 * registry's workflows. This copy also counts `github.token` as a secret and checkouts in privileged jobs as a problem.
 *
 * Usage: node scripts/check-workflow-secrets.mjs [workflows dir]   (exit 1 with the problems listed)
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** What marks a job as running pack code: the SDK's CLI, and the npm scripts that call it. */
export const PACK_CODE = /\bmc-pack\b|\bnpm\s+(run\s+)?(validate|test|build|init-pack)(?![\w:-])/;
const INSTALL = /\b(pnpm|npm|yarn)\s+(install|ci|i)\b/;
/** A secret or the job's token, inside a `${{ }}` expression (so a file name like check-workflow-secrets.mjs is not). */
const SECRET = /\$\{\{[^}]*\b(secrets\.|github\.token\b)/;
const WRITE = /^\s+[\w-]+:\s*write\b/m;
const CHECKOUT = /uses: actions\/checkout@/g;

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
  console.log("No job that runs pack code holds a secret, and no privileged job checks out or installs the pack.");
}
