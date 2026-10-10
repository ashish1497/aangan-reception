#!/usr/bin/env bash
# Builds, starts `next start` on port 3900, runs Lighthouse (mobile and desktop) and prints the scores.
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${LH_PORT:-3900}"
URL="http://127.0.0.1:${PORT}/"
npx next build
npx next start -p "$PORT" > /dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
for _ in $(seq 1 60); do curl -s -o /dev/null "$URL" && break; sleep 0.5; done
for mode in mobile desktop; do
  extra=""
  [ "$mode" = desktop ] && extra="--preset=desktop"
  out="/tmp/lh-${mode}.json"
  npx --yes lighthouse "$URL" --only-categories=performance,accessibility,best-practices,seo $extra \
    --chrome-flags="--headless=new --no-sandbox" --output=json --output-path="$out" --quiet
  node -e "const r=require('$out');console.log('$mode', Object.values(r.categories).map(c=>c.id+'='+Math.round(c.score*100)).join(' '))"
done
