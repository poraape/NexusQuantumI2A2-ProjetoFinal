#!/usr/bin/env bash
set -euo pipefail

SCENARIO=""
OUTDIR="artifacts/profiling"
mkdir -p "$OUTDIR"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --scenario)
      SCENARIO="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: $0 --scenario <name>"
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SCENARIO" ]]; then
  echo "Scenario name is required" >&2
  exit 1
fi

echo "Running profiling for scenario '$SCENARIO'..."

timestamp=$(date -u +"%Y%m%dT%H%M%SZ")
flamegraph="$OUTDIR/${timestamp}-${SCENARIO}.flamegraph.svg"
summary="$OUTDIR/${timestamp}-${SCENARIO}.json"

node scripts/profiling/scenario-runner.mjs "$SCENARIO" "$summary"

if command -v speedscope >/dev/null 2>&1; then
  speedscope "$summary" --out "$flamegraph"
else
  echo "speedscope not installed; skipping flamegraph generation" >&2
fi

echo "Profiling artifacts written to $OUTDIR"
