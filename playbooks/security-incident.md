# Playbook — Incidente de Segurança

1. Acionar modo de contingência revogando chaves comprometidas (Vault rotate).
2. Ativar bloqueio temporário de agentes suspeitos via `security/policies.yaml` (set `enabled=false`).
3. Executar auditoria completa (`audits/`) e registrar evidências.
4. Comunicar stakeholders e atualizar `reports/weekly/{date}.md` com RCA.
