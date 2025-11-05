# Instrumentação Inicial

1. **Trace Correlation**
   - Utilize o `traceId` do `telemetry/traces.json` como referência para implementar `performance.mark` e spans OpenTelemetry quando o backend estiver disponível.
   - Propague o `traceId` para as chamadas de `enqueueGeminiCall` e `contextMemory` para facilitar correlação entre agentes.

2. **Métricas Prometheus**
   - Exponha os indicadores descritos em `metrics/base.prom` por meio de um endpoint `/metrics` no BFF planejado.
   - Configure alertas de latência (`nexus_upload_duration_seconds{quantile="0.95"} > 0.4`) e fila (`nexus_gemini_queue_depth > 3`).

3. **Logs Estruturados**
   - Padronize logs com JSON contendo `traceId`, `agentId`, `sessionId` e `eventType`.
   - Armazene logs críticos em storage imutável para auditoria (ver `target_architecture` no blueprint).

4. **Próximos Passos**
   - Integrar a coleta no CI utilizando `npm test` para validar regressões antes do deploy.
   - Automatizar o upload dos artefatos de trace e métricas para um bucket versionado em cada release.
