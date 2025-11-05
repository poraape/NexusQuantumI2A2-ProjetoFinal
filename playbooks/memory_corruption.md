# Playbook — Corrupção de Memória

## Sintomas
- Falhas de leitura no vector store
- Checksums divergentes em `audits/cache-integrity.md`

## Passos
1. Isolar instância afetada marcando `memory` como `read-only` via feature flag.
2. Restaurar snapshot mais recente (`backups/{date}.tar.gz`).
3. Reindexar dados críticos executando `scripts/memory/reindex.sh`.
4. Validar consistência com `tests/characterization` e atualizar `reports/weekly/`.
