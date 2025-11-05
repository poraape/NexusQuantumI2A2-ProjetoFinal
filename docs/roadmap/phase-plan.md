# Roadmap Faseado — Multiagente

## Semana 1-2 — Higienização & Modularização
- Tarefas: 1.1, 1.2, 1.3
- Critérios de Aceitação: Interfaces TypeScript, web workers, logging estruturado.
- Back-out: `enableAsyncWorkers=false`.

## Semana 3-4 — Mensageria & Orquestração
- Tarefas: 2.1, 2.2
- Critérios: Event bus operando com DLQ, planner com retries configuráveis.
- Back-out: Fallback a chamadas diretas.

## Semana 5-6 — Introdução de Agentes
- Tarefas: 3.1, 3.2
- Critérios: Mocks ativos, UI consumindo BFF.
- Back-out: Desativar feature flags.

## Semana 7-8 — Integração Profunda
- Tarefas: 4.1, 4.2
- Critérios: SLOs cumpridos 7 dias, auditor agent assinando relatórios.
- Back-out: Rollback automático via SLO breach.

## Semana 9-10 — Otimização & Custo
- Tarefas: 5.1, 5.2
- Critérios: Custo por tarefa -30%, cold-start <= {SLA_MS}.
- Back-out: IaC versionado.

## Riscos x Mitigação
| Risco | Mitigação |
| --- | --- |
| Latência com event bus | Canary + flag `useEventBus` |
| Inconsistência de memória | Sincronização dupla e testes de regressão |
| Sobrecarga IA | Autoscaling + caching |

## Checkpoints
1. Conclusão da Fase B — UI intacta, mocks aprovados.
2. Go/No-Go Fase C — Dashboards e scripts de perf prontos.
3. Go-live final — Multiagente em produção com canary 30%.
