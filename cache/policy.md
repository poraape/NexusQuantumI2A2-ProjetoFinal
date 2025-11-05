# Política de Cache Multi-Camada

## 1. Objetivos
- Reduzir latência média e P95 em 30%.
- Minimizar chamadas redundantes a agentes cognitivos.
- Garantir consistência eventual com auditabilidade.

## 2. Camadas
### 2.1 Edge (CDN)
- TTL padrão: 60s para respostas estáticas e 15s para intents idempotentes.
- Cabeçalhos obrigatórios: `cache-control`, `x-trace-id`, `x-agent-id`.
- Invalidação: purga automática via webhook `POST /cache/invalidate`.

### 2.2 Memória Curta (Redis)
- Namespace: `session:{sessionId}` com TTL de 30 minutos.
- Políticas LRU por tipo (`chat`, `reports`, `forecasts`).
- Campos armazenados com hashes contendo `version`, `payload`, `expiresAt`.

### 2.3 Memória Longa (Vector Store)
- Index `reports-v1` (Qdrant) com retention 180 dias.
- Versionamento por `analysisId` e `agentVersion`.
- Re-indexação incremental executada por `Scheduler` diariamente.

## 3. Regras de Roteamento
| Payload | Edge | Redis | Vector |
| --- | --- | --- | --- |
| Chat follow-up | ✅ (15s) | ✅ (30m) | ✅ |
| Upload metadata | ❌ | ✅ (5m) | ❌ |
| Forecast baseline | ✅ (60s) | ✅ (12h) | ✅ |
| Executive summary | ❌ | ✅ (60m) | ✅ |

## 4. Invalidação
- Eventos `task.dispatch` com `invalidate=true` removem entradas Redis antes da execução.
- `agent.output` com `status=error` mantém caches intactos; sucesso dispara revalidação.
- Jobs `scheduler/rules.yaml` executam sweep de TTL expirados a cada 5 minutos.

## 5. Observabilidade
- Métricas: `cache_hit_total`, `cache_miss_total`, `cache_invalidation_total` (Prometheus).
- Logs estruturados em `telemetry/traces.json` com campo `cacheDecision`.
- Dashboards: `dashboards/cost-usage.json` painel `cacheHitRate`.

## 6. Governança
- Mudanças requerem revisão de arquitetura e atualização de `contracts/CHANGELOG.md`.
- Auditorias trimestrais documentadas em `audits/cache-integrity.md`.
