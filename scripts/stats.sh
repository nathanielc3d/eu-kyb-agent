#!/usr/bin/env bash
# Prints the usage counters (KV STATS): keys "YYYY-MM-DD:<event>:<route>"; event = paid | 402 | 400 | 502 | 503 | sample
cd "$(dirname "$0")/.."
for k in $(CI=1 npx wrangler kv key list --binding STATS --remote 2>/dev/null | grep '"name"' | sed 's/.*"name": "\(.*\)".*/\1/'); do
  echo "$k = $(CI=1 npx wrangler kv key get "$k" --binding STATS --remote 2>/dev/null)"
done
