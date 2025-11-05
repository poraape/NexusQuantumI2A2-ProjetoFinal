# Playbook — Congestionamento do Event Bus

## Sintomas
- Crescimento rápido no backlog `queueDepth`
- Latência de despacho > 2x P95

## Passos
1. Verificar métricas `batch_size_avg` e `batch_wait_ms` (dashboard `agent-health`).
2. Aumentar consumidores temporariamente (k scale) para filas afetadas.
3. Aplicar shedding de carga rebaixando prioridades via `scheduler/rules.yaml` (ajuste `maxWaitMs`).
4. Se necessário, ativar `enableBatching=false` para preservar SLA críticos.
5. Registrar incidente em `dr/logs/{date}.json`.
