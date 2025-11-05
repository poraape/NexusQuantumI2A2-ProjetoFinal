# Playbook — Fallback de Modelo

1. Identificar modelo degradado via `dashboards/cost-usage.json` (painel `modelQuality`).
2. Atualizar `config/flags.json` habilitando `useMockAgents` ou `useLocalModel`.
3. Redirecionar tráfego no gateway (`gateway/config.yaml`) para `{MODEL_LOCAL}`.
4. Confirmar métricas em `reports/weekly/{date}.md` e comunicar stakeholders.
