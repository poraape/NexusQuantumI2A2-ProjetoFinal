# Playbook — Execução Híbrida Local/Serverless

## Passos
1. Validar capacidade local (`{MODEL_LOCAL}`) via `scripts/perf/serverless-coldstart.mjs`.
2. Implantar versão serverless conforme `infra/serverless.yaml`.
3. Atualizar `catalog/agents.yaml` com endpoints ativos e SLAs.
4. Configurar fallback automático no planner (`adapters/plannerAdapter.ts`).
5. Registrar custos no painel `dashboards/cost-usage.json`.
