#!/usr/bin/env bash
set -euo pipefail

MODEL_ID=${1:-}
if [[ -z "$MODEL_ID" ]]; then
  echo "Usage: $0 <model-id>" >&2
  exit 1
fi

echo "[rollback] iniciando rollback para $MODEL_ID"
# TODO: integrar com registry e infraestrutura real
