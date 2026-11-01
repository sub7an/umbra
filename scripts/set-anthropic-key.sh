#!/bin/zsh
# Store a new Anthropic API key for the AI features, without it ever being
# shown on screen or written anywhere public:
#   • locally in .env (gitignored) for `npm run dev`
#   • in Vercel as a server-only production variable for /api/ai
# Run from anywhere:  zsh scripts/set-anthropic-key.sh
set -e
cd "$(dirname "$0")/.."

printf 'Paste your new Anthropic API key (it stays hidden), then press Enter: '
read -rs KEY
echo
if [[ "$KEY" != sk-ant-* ]]; then
  echo "That doesn't look like an Anthropic key (it should start with sk-ant-). Nothing was changed."
  exit 1
fi

# Local: replace any old entry
touch .env
sed -i '' '/^ANTHROPIC_API_KEY=/d;/^VITE_ANTHROPIC_API_KEY=/d' .env
printf 'ANTHROPIC_API_KEY=%s\n' "$KEY" >> .env
echo "✓ Saved to .env"

# Vercel (only when this checkout is linked to a Vercel project): drop the old
# browser-exposed variable and any previous server key
if command -v vercel >/dev/null 2>&1 && [[ -f .vercel/project.json ]]; then
  vercel env rm VITE_ANTHROPIC_API_KEY production --yes >/dev/null 2>&1 || true
  vercel env rm ANTHROPIC_API_KEY production --yes >/dev/null 2>&1 || true
  printf '%s' "$KEY" | vercel env add ANTHROPIC_API_KEY production >/dev/null
  echo "✓ Saved to Vercel (production); redeploy to pick it up"
else
  echo "• Not linked to Vercel; skipped the production key"
fi
unset KEY
echo "Done."
