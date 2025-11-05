# Migração 001 — Versionamento de Agentes

## Escopo
- Introdução de versionamento semântico para agentes existentes.
- Atualização de contratos para incluir `agentVersion` no envelope `agent.output`.

## Passos
1. Atualizar `schemas/msg/1.0.0/agent.output.json` adicionando campo `agentVersion` (compatível).
2. Registrar versões iniciais em `catalog/agents.yaml`.
3. Atualizar testes de compatibilidade (`tests/compatibility.spec.mjs`).
4. Comunicar consumidores externos via release notes.

## Backout
- Reverter para tag anterior e remover campo `agentVersion`.
