#!/usr/bin/env bash
set -e
REPO_NAME="thorkc"
REMOTE="origin"
BRANCH="main"

# If repo already exists locally, skip init
if [ ! -d .git ]; then
  git init
  git checkout -b $BRANCH
fi

# Add all files
git add -A
git commit -m "Initial ThorKC scaffold" || true

# If remote not set, try to create or set it
if ! git remote get-url $REMOTE >/dev/null 2>&1; then
  # Create GitHub repo and push (requires gh CLI)
  if command -v gh >/dev/null 2>&1; then
    gh repo create "$REPO_NAME" --public --source=. --remote=$REMOTE --push
  else
    echo "gh CLI not found. Please create a GitHub repo named $REPO_NAME and add remote, then run: git push -u origin $BRANCH"
    exit 1
  fi
else
  git push -u $REMOTE $BRANCH
fi

echo "Push complete. Cloudflare Pages will build automatically if connected to this repo."
