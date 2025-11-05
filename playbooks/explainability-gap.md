# Playbook — Falha de Explainability

1. Identificar agente sem rationale via alerta `rationale-missing`.
2. Reprocessar tarefa com flag `requireRationale=true`.
3. Caso persista, escalar para time de AI Safety e aplicar rollback de modelo.
4. Documentar ocorrência em `audits/model-decisions.ndjson`.
