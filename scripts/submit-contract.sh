#!/usr/bin/env bash
# The submission contract, end to end, with the exact SDK a creator installs: a clean copy of this template's
# committed sample, made into a pack with init-pack, its permission set from a fixture, committed and tagged in a
# throwaway repo that stands in for GitHub, then
#
#   1. with a pending permission: the submit-pack script and `mc-pack validate . --publish` both refuse it;
#   2. with a granted permission: the submit-pack script prints Ready and writes submission/<id>.yaml with the tag's
#      commit, and `mc-pack validate . --publish` passes;
#   3. with REGISTRY_DIR set (a checkout of quincarter/marvel-champions-mods): the registry's own
#      scripts/build-entry.sh builds that submission file from the tagged commit and compares its zip with the one the
#      creator built (standing in for the zip the release job attaches).
#
#   scripts/submit-contract.sh <mod-sdk .tgz>     (CI: the tarball the sdk job built, or `npm pack` of the npm release)
#
# Needs git, node and npm; step 3 also needs jq, yq and sha256sum (preinstalled on GitHub's Ubuntu runners). The SDK
# goes into the throwaway pack as vendor/mod-sdk.tgz with a committed package-lock.json, so the registry's `npm ci`
# installs those exact bytes. GitHub is never contacted: GIT_CONFIG_GLOBAL points git at a private config whose
# url.<path>.insteadOf sends https://github.com/contract/contract-hero to a local bare repo, and gh runs signed out.
# No token is used.
set -euo pipefail

tgz="${1:?usage: scripts/submit-contract.sh <mod-sdk .tgz>}"
tgz="$(cd "$(dirname "$tgz")" && pwd)/$(basename "$tgz")"
template="$(cd "$(dirname "$0")/.." && pwd)"
registry="${REGISTRY_DIR:+$(cd "$REGISTRY_DIR" && pwd)}"
fixtures="$template/scripts/fixtures/submit-contract"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
# A path git itself can use on every OS (Git Bash's /c/... is not one on Windows).
native() { (cd "$1" && (pwd -W 2>/dev/null || pwd)); }

id=contract-hero
repo="https://github.com/contract/$id"
export GIT_CONFIG_GLOBAL="$work/gitconfig" GIT_CONFIG_NOSYSTEM=1
# gh signed out, so the submit script notes the release check instead of asking GitHub about a repo that isn't there.
export GH_CONFIG_DIR="$work/gh"
unset GH_TOKEN GITHUB_TOKEN GH_ENTERPRISE_TOKEN
git config --global user.name "Contract Test"
git config --global user.email "contract@example.invalid"
git config --global init.defaultBranch main
git init -q --bare "$work/origin.git"
git config --global "url.$(native "$work/origin.git").insteadOf" "$repo"

step() { echo "::group::$*"; }
fail() { echo "::error::submit contract: $*"; exit 1; }

step "A clean copy of the sample, made into $id"
# The files git tracks, as they are in the working tree (so a local run tests uncommitted edits to them): never
# node_modules, build output, CI's registry checkout or anything else untracked.
mkdir "$work/pack"
(cd "$template" && git ls-files -z --cached | while IFS= read -r -d "" f; do
  [[ -e "$f" ]] && printf '%s\0' "$f"
done | tar --null -T - -cf -) | tar -x -C "$work/pack"
cd "$work/pack"
mkdir vendor
cp "$tgz" vendor/mod-sdk.tgz
npm install --ignore-scripts --no-audit --no-fund --save-dev ./vendor/mod-sdk.tgz
node scripts/init-pack.mjs --id "$id" --name "Contract Hero" --author "Contract Test"
version=$(node -p "require('./pack.json').version")
tag="v$version"
echo "::endgroup::"

# Sets pack.json's permission to a fixture.
permission() {
  node -e '
    const fs = require("fs");
    const pack = JSON.parse(fs.readFileSync("pack.json", "utf8"));
    pack.permission = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    fs.writeFileSync("pack.json", JSON.stringify(pack, null, 2) + "\n");
  ' "$fixtures/$1.json"
}
# Commits, tags and pushes the pack as it stands.
release() {
  git add -A
  git commit -q -m "$1"
  git tag -f "$tag" > /dev/null
  git push -q -f origin HEAD:main "refs/tags/$tag"
}

step "Pending permission: refused by the submit script and by mc-pack validate --publish"
git init -q
git remote add origin "$repo"
permission pending
release "Pending permission"
if out=$(node .agents/skills/submit-pack/scripts/submit.mjs --skip-build 2>&1); then
  echo "$out"
  fail "submit.mjs accepted a pending permission"
fi
echo "$out"
grep -q "permission.status is pending, not granted" <<< "$out" || fail "submit.mjs did not name the pending permission"
grep -q "mc-pack validate . --publish failed" <<< "$out" || fail "submit.mjs did not report the SDK's publish check"
if npx --no-install mc-pack validate . --publish; then fail "mc-pack validate --publish accepted a pending permission"; fi
echo "::endgroup::"

step "Granted permission: the submit script is Ready and mc-pack validate --publish passes"
permission granted
release "Granted permission"
node .agents/skills/submit-pack/scripts/submit.mjs --tags hero --summary "Contract test pack" | tee "$work/submit.log"
grep -q "^Ready\." "$work/submit.log" || fail "submit.mjs did not print Ready"
npx --no-install mc-pack validate . --publish
entry="submission/$id.yaml"
commit=$(git rev-parse "$tag^{commit}")
grep -qx "id: $id" "$entry" || fail "$entry: wrong id"
grep -qx "repo: $repo" "$entry" || fail "$entry: wrong repo"
grep -qx "tag: $tag" "$entry" || fail "$entry: wrong tag"
grep -qx "commit: $commit" "$entry" || fail "$entry: commit is not the tag's ($commit)"
grep -qx "  by: $(node -p "require('./pack.json').permission.by")" "$entry" || fail "$entry: permission.by is not pack.json's"
echo "::endgroup::"

if [[ -z "$registry" ]]; then
  echo "REGISTRY_DIR is not set: the registry's build-entry step is skipped."
  exit 0
fi

step "The registry's build-entry.sh on the submission file"
mkdir -p "$work/entries" "$work/registry-work/release"
cp "$entry" "$work/entries/$id.yaml"
# The zip the creator built from the tagged commit stands in for the one the release job attaches.
cp "build/$id-$version.zip" "$work/registry-work/release/"
(cd "$work" && bash "$registry/scripts/build-entry.sh" "entries/$id.yaml" "$work/registry-work")
cat "$work/registry-work/summary.md"
echo "::endgroup::"
echo "The registry built $id $version from $tag and its zip matches the creator's."
