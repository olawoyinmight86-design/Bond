#!/bin/bash
# Bond — GitHub Push Script
# Run this script to initialize a git repo and push to GitHub.
#
# Usage:
#   chmod +x push-to-github.sh
#   ./push-to-github.sh <your-github-username> <repo-name>
#
# Example:
#   ./push-to-github.sh johnbond bond-app
#
# If you have "gh" (GitHub CLI) installed, this script will create
# the repo automatically. Otherwise it will give you the URL to
# create it manually.

set -e

USERNAME=$1
REPO=$2

if [ -z "$USERNAME" ] || [ -z "$REPO" ]; then
  echo "Usage: ./push-to-github.sh <github-username> <repo-name>"
  echo "Example: ./push-to-github.sh johnbond bond-app"
  exit 1
fi

echo "=== Bond — GitHub Push ==="
echo "Username: $USERNAME"
echo "Repo: $REPO"
echo ""

# Initialize git
if [ ! -d .git ]; then
  echo "Initializing git repository..."
  git init
fi

# Add all files
echo "Staging files..."
git add -A

# Commit
echo "Creating commit..."
git commit -m "Bond — a private space for two

- Vite + React 18 + TypeScript + Tailwind CSS
- Supabase backend (auth, realtime, edge functions)
- PWA with offline support (service worker, cached data)
- Screens: Auth, Onboarding, Pairing, Dashboard, Timeline, Chat, Settings
- Premium design system with glassmorphism, warm color palette
- Realtime chat, presence tracking, shared timeline
- AI companion edge function with relationship tips"

# Check if gh CLI is available
if command -v gh &> /dev/null; then
  echo "Creating GitHub repo with gh CLI..."
  gh repo create "$REPO" --public --source=. --remote=origin --push
  echo ""
  echo "Done! Your repo is at: https://github.com/$USERNAME/$REPO"
else
  REMOTE_URL="https://github.com/$USERNAME/$REPO.git"
  echo ""
  echo "gh CLI not found. Please:"
  echo "1. Go to https://github.com/new"
  echo "2. Create a new repo named '$REPO' (don't initialize with README)"
  echo "3. Run these commands:"
  echo ""
  echo "   git remote add origin $REMOTE_URL"
  echo "   git branch -M main"
  echo "   git push -u origin main"
  echo ""
  echo "Or install GitHub CLI: https://cli.github.com/"
  echo "Then re-run this script."
fi

echo ""
echo "=== Done ==="
