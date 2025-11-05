# Playbook — IA Outage

## Sintomas
- Respostas 5xx do gateway de modelos
- Tempo de espera > {SLA_MS}

## Passos
1. Acionar feature flag `useMockAgents` para manter UI responsiva.
2. Redirecionar tráfego para modelo local (`{MODEL_LOCAL}`) via `infra/serverless.yaml`.
3. Executar `scripts/models/rollback.sh cognitive-analyst-v1` se a versão atual falhar.
4. Comunicar status no canal #incident-ai e registrar em `reports/weekly/{date}.md`.
