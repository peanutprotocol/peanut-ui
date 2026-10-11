#!/usr/bin/env bash
# Posts one release-failure line to Discord. The failed run stays red either
# way: a missing webhook or a failed post only adds a warning, so the alert can
# degrade but never hides the failure.
set -uo pipefail
MESSAGE="${1:?message is required}"
echo "::error::$MESSAGE"
if [ -z "${DISCORD_WEBHOOK:-}" ]; then
  echo "::warning::no Discord webhook is configured; this failed run is the only alert"
  exit 0
fi
# Built with node so quotes and newlines in the message stay valid JSON.
PAYLOAD="$(MESSAGE="$MESSAGE" node -e 'process.stdout.write(JSON.stringify({ content: process.env.MESSAGE, allowed_mentions: { parse: [] } }))')"
if curl -fsS --retry 3 --retry-all-errors --max-time 15 \
    -H 'Content-Type: application/json' -H 'User-Agent: peanut-release-alert/1.0' \
    -d "$PAYLOAD" "$DISCORD_WEBHOOK" >/dev/null; then
  echo "Posted the alert to Discord"
else
  echo "::warning::Discord post failed; this failed run is the only alert"
fi
