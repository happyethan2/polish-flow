#!/usr/bin/env bash
#
# Deploy Polish Flow to the home server from this dev machine.
#
# Workflow: do feature work on branches, merge into `main` when tested, then deploy `main`.
# This script deploys `main` by default so the live site always tracks the blessed branch.
# It never merges — merging stays a deliberate `git` step so conflicts are handled by you,
# not silently by a script. It only builds a branch that is already merged and pushed.
#
# What it does: confirm the deploy branch is pushed to GitHub, copy the (gitignored) .env to
# the server, then have the server reset its checkout to origin/<branch>, build, and atomically
# swap the static build into the directory Tailscale Serve publishes. The build is produced
# server-side from origin/<branch>, so your local working tree never affects the artifact
# (a dirty tree is a warning, not an error). rsync is not on the server, so the sync uses cp/mv.
#
# Usage:
#   ./deploy.sh              # deploy main (the normal case)
#   ./deploy.sh some-branch  # deploy a specific pushed branch (e.g. to trial it live)
#
# Runs under Git Bash on Windows (uses ssh + scp, which ship with Git for Windows).

set -euo pipefail

# ---- config -----------------------------------------------------------------
SERVER="ethan@192.168.1.113"
REPO_URL="https://github.com/happyethan2/polish-flow.git"
REMOTE_BASE="/home/ethan/apps/polish-flow"
REMOTE_REPO="$REMOTE_BASE/repo"
REMOTE_CURRENT="$REMOTE_BASE/current"
ENV_FILE=".env"
BRANCH="${1:-main}"

say()  { printf '\n\033[1;36m→ %s\033[0m\n' "$1"; }
warn() { printf '\n\033[1;33m! %s\033[0m\n' "$1"; }
die()  { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ---- dev-side preflight ------------------------------------------------------
say "Deploying branch '$BRANCH' to $SERVER"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."
[ -f "$ENV_FILE" ] || die "$ENV_FILE not found. It holds VITE_GOOGLE_API_KEY needed for the build."

# The server builds from origin/$BRANCH, so uncommitted local edits never ship — just warn.
if [ -n "$(git status --porcelain)" ]; then
    warn "Working tree has uncommitted changes; they will NOT be deployed (only origin/$BRANCH is built)."
fi

say "Fetching origin to confirm '$BRANCH' is pushed and up to date…"
git fetch --quiet origin "$BRANCH" || die "Branch '$BRANCH' does not exist on origin. Merge/push it first."

# If a local copy of the deploy branch exists, make sure it matches origin — this catches the
# common mistake of merging into main locally but forgetting to push before deploying.
if git rev-parse --verify --quiet "$BRANCH" >/dev/null; then
    LOCAL_SHA="$(git rev-parse "$BRANCH")"
    REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
    if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
        die "Local $BRANCH ($LOCAL_SHA) != origin/$BRANCH ($REMOTE_SHA). Push it first: git push origin $BRANCH"
    fi
fi

# ---- copy the (gitignored) env file -----------------------------------------
say "Copying $ENV_FILE to the server…"
scp -q "$ENV_FILE" "$SERVER:$REMOTE_BASE/.env.deploy" || die "Failed to copy $ENV_FILE."

# ---- server-side build & atomic swap ----------------------------------------
say "Building on the server and swapping into current/ …"
ssh "$SERVER" BRANCH="$BRANCH" REPO_URL="$REPO_URL" REMOTE_BASE="$REMOTE_BASE" \
    REMOTE_REPO="$REMOTE_REPO" REMOTE_CURRENT="$REMOTE_CURRENT" 'bash -s' <<'REMOTE'
set -euo pipefail

# Clone on first run, otherwise hard-reset to the pushed branch.
if [ ! -d "$REMOTE_REPO/.git" ]; then
    echo "  cloning $REPO_URL"
    git clone "$REPO_URL" "$REMOTE_REPO"
fi
cd "$REMOTE_REPO"
git fetch --quiet origin "$BRANCH"
git checkout --quiet "$BRANCH"
git reset --hard "origin/$BRANCH"

# The build needs the env file (Vite inlines VITE_GOOGLE_API_KEY at build time).
mv -f "$REMOTE_BASE/.env.deploy" "$REMOTE_REPO/.env"

echo "  npm ci"
npm ci --no-audit --no-fund
echo "  npm run build"
npm run build

# Atomic-ish swap: stage the fresh build, then replace current/ with a quick mv pair.
rm -rf "$REMOTE_BASE/current.new"
cp -a "$REMOTE_REPO/dist" "$REMOTE_BASE/current.new"
rm -rf "$REMOTE_BASE/current.prev"
if [ -d "$REMOTE_CURRENT" ]; then
    mv "$REMOTE_CURRENT" "$REMOTE_BASE/current.prev"
fi
mv "$REMOTE_BASE/current.new" "$REMOTE_CURRENT"
rm -rf "$REMOTE_BASE/current.prev"

# Drop the build-time secret from the server checkout.
rm -f "$REMOTE_REPO/.env"

echo "  deployed $(git rev-parse --short HEAD) -> $REMOTE_CURRENT"
REMOTE

say "Done. Live at https://pc-server.tail994c3.ts.net:8443"
