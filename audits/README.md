# Auditoria Multiagente

## Campos Obrigatórios
- `timestamp`
- `agentId`
- `action`
- `inputs`
- `outputs`
- `rationale`
- `references`

## Procedimento
1. Coletar eventos de `agent.output` com `audit=true`.
2. Persistir no formato NDJSON em `audits/{date}-trail.ndjson`.
3. Assinar digitalmente cada arquivo (hash SHA-256) e armazenar em cofre.
