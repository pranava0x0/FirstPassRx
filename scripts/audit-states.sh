#!/usr/bin/env bash
# Run the deterministic cell audit for many states in sequence (rows/index.json is not safe for
# concurrent writers, so never run two audits at once).
#   scripts/audit-states.sh <out-root> <topics-csv|all> KY OH ...
#   scripts/audit-states.sh data-gathering/audit-2026-11-22 acid-reflux,thyroid KY OH
set -euo pipefail
out=$1; topics=$2; shift 2
mkdir -p "$out"
for s in "$@"; do
  l=$(echo "$s" | tr '[:upper:]' '[:lower:]')
  if [ "$topics" = all ]; then g=""; else g="--guides=$(echo "$topics" | tr ',' '\n' | sed "s/^/$l-/" | paste -sd, -)"; fi
  printf '%s ' "$s"
  node scripts/audit-cells.mjs --state="$s" $g --out="$out/$l" 2>&1 | tail -1
done
