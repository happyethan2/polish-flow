#!/usr/bin/env bash
#
# Deploy Polish Flow to the home server from this dev machine.
#
# Flow: verify the working tree is clean and the branch is pushed to GitHub, copy the
# (gitignored) .env to the server, then have the server clone/update the repo, build, and
# atomically swap the static build into the directory Tailscale Serve publishes.
#
# The server serves ~/apps/polish-flow/current as plain static files (Tailscale Serve on
# :8443), so "deploy" just means replacing that directory with a fresh `vite build`.
# rsync is not installed on the server, so the sync is done there with cp/mv instead.
#
# Usage:
#   ./deploy.sh              # deploy the current branch (must be pushed)
#   ./deploy.sh main         # deploy an explicit branch
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
BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"

say() { printf '\n\033[1;36m→ %s\033[0m\n' "$1"; }
die() { printf '\n\033[1;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ---- dev-side preflight ------------------------------------------------------
say "Deploying branch '$BRANCH' to $SERVER"

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "Not inside a git repository."

# Working tree must be clean — we deploy exactly what is committed and pushed, nothing local.
if ! git diff-index --quiet HEAD -- 2>/dev/null || [ -n "$(git status --porcelain)" ]; then
    die "Working tree is dirty. Commit or stash your changes before deploying."
fi

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found. It holds VITE_GOOGLE_API_KEY needed for the build."

say "Fetching origin to confirm '$BRANCH' is pushed and up to date…"
git fetch --quiet origin "$BRANCH" || die "Branch '$BRANCH' does not exist on origin. Push it first."

LOCAL_SHA="$(git rev-parse HEAD)"
REMOTE_SHA="$(git rev-parse "origin/$BRANCH")"
if [ "$LOCAL_SHA" != "$REMOTE_SHA" ]; then
    die "Local HEAD ($LOCAL_SHA) != origin/$BRANCH ($REMOTE_SHA). Push your latest commits first."
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
