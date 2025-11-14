// backend/agents/analysisAgent.js

const { model, availableTools } = require('../services/geminiClient');
const { buildAnalysisContext } = require('../services/artifactUtils');
const {
    extractKeyMetricsFromFiles,
    formatKeyMetricsSummary,
    mergeKeyMetricsWithComputed,
} = require('../services/keyMetricsExtractor');

function robustJsonParse(jsonString) {
    // Tenta extrair o JSON de um bloco de código Markdown
    const match = /```json\n([\s\S]*?)\n```/.exec(jsonString);
    if (match && match[1]) {
        try {
            return JSON.parse(match[1]);
        } catch (e) {
            // Se a extração falhar, pode ser que o JSON esteja malformado
            throw new Error(`Falha ao analisar o JSON extraído do bloco de código: ${e.message}`);
        }
    }
    // Fallback para o caso de a IA retornar JSON puro (sem o Markdown)
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        throw new Error(`A resposta não é um JSON válido nem um bloco de código JSON: ${e.message}`);
    }
}

function estimateTokens(text) {
    return Math.ceil((text || '').length / 4);
}

function register({ eventBus, updateJobStatus, metrics }) {
    // Agente de Análise (IA)
    eventBus.on('task:start', async ({ jobId, taskName, payload }) => {
        if (taskName !== 'analysis') return;
        try {
            const artifacts = payload.artifacts || [];
            const fileContentsForAnalysis = payload.fileContentsForAnalysis || artifacts.map(art => ({ fileName: art.fileName, content: art.text }));
            const aggregatedMetrics = extractKeyMetricsFromFiles(fileContentsForAnalysis);
            const aggregatedSummaryText = formatKeyMetricsSummary(aggregatedMetrics);
            await updateJobStatus(jobId, 4, 'in-progress', 'Ag. Inteligência: Gerando análise executiva...');
            const { context, stats } = buildAnalysisContext(artifacts);

            const prompt = `
Você é um analista fiscal especializado. Com base nos dados agregados e nos resumos abaixo, produza um JSON seguindo a estrutura:
{
  "title": string,
  "description": string,
  "keyMetrics": {
    "numeroDeDocumentosValidos": number,
    "valorTotalDasNfes": number,
    "valorTotalDosProdutos": number,
    "indiceDeConformidadeICMS": string,
    "nivelDeRiscoTributario": string,
    "estimativaDeNVA": number
  },
  "actionableInsights": [{ "text": string }],
  "simulationResult": object | null
}

Use as estatísticas agregadas e o contexto resumido. Os dados já foram pré-validados por outros agentes.
${aggregatedSummaryText ? `Métricas extraídas automaticamente:\n${aggregatedSummaryText}` : ''}
Se identificar que o valor total das notas supera 100000, use a ferramenta 'tax_simulation' com regime 'Lucro Real'.
Se encontrar um tópico fiscal complexo ou uma dúvida sobre legislação (ex: "crédito presumido", "substituição tributária"), use a ferramenta 'consult_fiscal_legislation' para buscar esclarecimentos antes de formular seus insights.
Não use ferramentas para validações simples como CNPJ, pois isso já foi feito.

Estatísticas agregadas:
${JSON.stringify(stats, null, 2)}

Contexto resumido:
${context || fileContentsForAnalysis.map(f => `### Documento: ${f.fileName}\n${(f.content || '').slice(0, 1200)}`).join('\n\n')}
`;

            const tokens = estimateTokens(prompt);
            if (metrics && typeof metrics.observeSummary === 'function') {
                metrics.observeSummary('analysis_prompt_tokens', tokens);
            }

            const chat = model.startChat({
                tools: availableTools,
            });

            const result = await chat.sendMessage(prompt);
            const call = result.response.functionCalls()?.[0];

            if (call) {
                console.log(`[AnalysisAgent] Job ${jobId}: IA solicitou o uso da ferramenta '${call.name}'. Acionando o ToolsAgent.`);
                const enrichedPayload = { ...payload, analysisAggregatedMetrics: aggregatedMetrics };
                // A IA quer usar uma ferramenta. Pausamos esta tarefa e pedimos ao Orquestrador para executar a ferramenta.
                eventBus.emit('tool:run', { jobId, toolCall: call, payload: enrichedPayload, prompt });
                // A continuação ocorrerá quando o Orquestrador receber 'tool:completed'
            } else {
                // A IA respondeu diretamente.
                const executiveSummary = robustJsonParse(result.response.text());
                if (executiveSummary) {
                    executiveSummary.keyMetrics = mergeKeyMetricsWithComputed(executiveSummary.keyMetrics || {}, aggregatedMetrics);
                }
                await updateJobStatus(jobId, 4, 'completed');
                eventBus.emit('task:completed', { jobId, taskName, resultPayload: { executiveSummary }, payload: payload });
            }

        } catch (error) {
            eventBus.emit('task:failed', { jobId, taskName, error: `Falha na análise da IA: ${error.message}` });
        }
    });

    // O Orquestrador recebe o resultado da ferramenta e devolve ao Agente de Análise para que ele continue seu raciocínio.
    eventBus.on('orchestrator:tool_completed', async ({ jobId, toolResult, originalPayload, prompt, toolName }) => {
        try {
            console.log(`[Orquestrador] Job ${jobId}: Resultado da ferramenta recebido. Devolvendo ao Agente de Análise.`);
            const followUpPrompt = `
${prompt}

Resultado da ferramenta '${toolName || 'tax_simulation'}':
${JSON.stringify(toolResult, null, 2)}

Atualize o JSON final seguindo exatamente a mesma estrutura definida anteriormente.`.trim();

            const result = await model.generateContent({
                contents: [{ parts: [{ text: followUpPrompt }] }],
            });

            const executiveSummary = robustJsonParse(result.response.text());
            const aggregatedMetrics = originalPayload?.analysisAggregatedMetrics || {};
            if (executiveSummary) {
                executiveSummary.keyMetrics = mergeKeyMetricsWithComputed(executiveSummary.keyMetrics || {}, aggregatedMetrics);
            }
            await updateJobStatus(jobId, 4, 'completed', 'Análise com simulação concluída.');
            eventBus.emit('task:completed', { jobId, taskName: 'analysis', resultPayload: { executiveSummary }, payload: originalPayload });

        } catch (error) {
            eventBus.emit('task:failed', { jobId, taskName: 'analysis', error: `Falha na etapa de síntese pós-ferramenta: ${error.message}` });
        }
    });
}

module.exports = { register };
