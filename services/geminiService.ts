import { Part } from '@google/genai';
import {
  ExecutiveSummary,
  ProcessingStepStatus,
  SimulationResult,
  ComparativeAnalysisReport,
  LogError,
  TaxScenario,
  ClassificationResult,
} from '../types';
import { parseFile, extractFullTextFromFile } from './fileParsers.ts';
import { getApiKey } from '../config.ts';

const CHUNK_TOKEN_THRESHOLD = 7000; // Reduced for safety margin
const MAX_RESPONSE_TOKENS_SUMMARY = 1500;
const MAX_RESPONSE_TOKENS_COMPARE = 2500;
const MAX_RESPONSE_TOKENS_FULL = 3500;
const THROTTLE_DELAY_MS = 1000; // Minimum 1 second between API calls

const GEMINI_PROXY_URL = "https://nexus-quantumi2a2-747991255581.us-west1.run.app/api-proxy/v1beta/models";
const GEMINI_DIRECT_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-2.5-flash";

interface GeminiApiResponse {
  candidates?: {
    content: { parts: { text: string }[] };
    finishReason?: string;
  }[];
  promptFeedback?: { blockReason: string };
  text: string;
  json: () => any;
}

// --- Throttling and API Call Strategy ---

let lastApiCallTimestamp = 0;

// FIX: Export 'callGeminiThrottled' to be used by other services like the classifier.
export const callGeminiThrottled = async (
  parts: Part[],
  isJsonMode: boolean,
  logError: (error: Omit<LogError, 'timestamp'>) => void,
  attempt = 1
): Promise<GeminiApiResponse> => {
    const now = Date.now();
    const elapsed = now - lastApiCallTimestamp;
    if (elapsed < THROTTLE_DELAY_MS) {
        const waitTime = THROTTLE_DELAY_MS - elapsed;
        console.debug(`[Throttler] Waiting for ${waitTime}ms before next API call.`);
        await new Promise(res => setTimeout(res, waitTime));
    }
    lastApiCallTimestamp = Date.now();

    const MAX_RETRIES = 4;
    try {
        const response = await _callGeminiApiOnce(parts, isJsonMode);
        if (!response.text && !response.candidates) {
            const blockReason = response.promptFeedback?.blockReason;
            throw new Error(`A resposta da IA estava vazia ou foi bloqueada. Motivo: ${blockReason || 'Desconhecido'}.`);
        }
        return response;
    } catch (error: any) {
        const errorMessage = error.toString().toLowerCase();
        const isRateLimitError = errorMessage.includes('429');
        
        if (isRateLimitError && attempt < MAX_RETRIES) {
            const waitTime = Math.min(60000, (2 ** attempt) * 1000 + Math.random() * 2000); // Exponential backoff with jitter
            const logMessage = `Limite de taxa da API atingido (tentativa ${attempt}). Tentando novamente em ${Math.round(waitTime / 1000)}s...`;
            logError({
                source: 'geminiService.throttler',
                message: logMessage,
                severity: 'warning',
                details: { error: error.message },
            });
            await new Promise(res => setTimeout(res, waitTime));
            return callGeminiThrottled(parts, isJsonMode, logError, attempt + 1);
        } else {
             const finalErrorMessage = isRateLimitError
                ? `Limite de taxa da API excedido após múltiplas tentativas. Verifique seu plano e faturamento.`
                : `Falha na API Gemini após ${attempt} tentativas. Erro: ${error.message}`;
             throw new Error(finalErrorMessage);
        }
    }
};

const _callGeminiApiOnce = async (
    parts: Part[],
    isJsonMode: boolean
): Promise<GeminiApiResponse> => {
    const model = DEFAULT_MODEL;
    const payload = {
        contents: [{ parts }],
        ...(isJsonMode && { generationConfig: { responseMimeType: 'application/json' } })
    };

    try {
        console.debug(`[GeminiService] Tentando API via proxy...`);
        const proxyResponse = await fetch(`${GEMINI_PROXY_URL}/${model}:generateContent`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        if (!proxyResponse.ok) throw new Error(`Proxy error status: ${proxyResponse.status} ${proxyResponse.statusText}`);
        const proxyData = await proxyResponse.json();
        if (proxyData.error) throw new Error(`Proxy response error: ${proxyData.error.message}`);
        const responseText = proxyData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return { ...proxyData, text: responseText, json: () => proxyData };
    } catch (error) {
        console.warn("[GeminiService] Proxy falhou. Usando API direta.", error);
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("API Key não encontrada para fallback direto.");

        const directResponse = await fetch(`${GEMINI_DIRECT_URL}/${model}:generateContent?key=${apiKey}`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const directData = await directResponse.json();
        if (!directResponse.ok) {
            const apiErrorMsg = directData?.error?.message || 'Erro desconhecido na API direta.';
            throw new Error(`Direct API error: ${directResponse.status} - ${apiErrorMsg}`);
        }
        if (directData.error) throw new Error(`Direct API response error: ${directData.error.message}`);
        console.debug("[GeminiService] Fallback direto bem-sucedido.");
        const responseText = directData.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        return { ...directData, text: responseText, json: () => directData };
    }
};

// --- Helper Functions ---

export const estimateTokens = (text: string): number => Math.ceil(text.length / 4);

export const parseGeminiJsonResponse = <T>(text: string, logError: (error: Omit<LogError, 'timestamp'>) => void): T => {
    try {
        return JSON.parse(text) as T;
    } catch (e) {
        logError({
            source: 'geminiService.jsonParser',
            message: 'Falha ao analisar a resposta JSON da Gemini.',
            severity: 'critical',
            details: { error: e, responseText: text },
        });
        throw new Error("A resposta da IA não está em um formato JSON válido.");
    }
};

export const getFileContentForAnalysis = async (
    files: File[],
    updatePipelineStep: (index: number, status: ProcessingStepStatus, info?: string) => void,
    logError: (error: Omit<LogError, 'timestamp'>) => void
): Promise<{fileName: string, content: string}[]> => {
    const parsedFileContents: {fileName: string, content: string}[] = [];
    for (const file of files) {
        try {
            updatePipelineStep(0, ProcessingStepStatus.IN_PROGRESS, `Lendo e extraindo dados de: ${file.name}`);
            const result = await parseFile(file, (progressInfo) => {
                 updatePipelineStep(0, ProcessingStepStatus.IN_PROGRESS, `${file.name}: ${progressInfo}`);
            });
            if (result.type === 'text') {
                parsedFileContents.push({fileName: file.name, content: result.content});
            }
        } catch (e) {
            logError({
                source: 'fileParser', message: `Falha ao processar o arquivo ${file.name}`, severity: 'warning', details: e,
            });
        }
    }
    return parsedFileContents;
}

export const getFullContentForIndexing = async (
    files: File[],
    logError: (error: Omit<LogError, 'timestamp'>) => void
): Promise<{fileName: string, content: string}[]> => {
     const fullFileContents: {fileName: string, content: string}[] = [];
    for (const file of files) {
        try {
            const content = await extractFullTextFromFile(file);
            if (content && content.length > 50) {
                 fullFileContents.push({ fileName: file.name, content });
            }
        } catch (e) {
            logError({
                source: 'getFullContentForIndexing', message: `Falha ao extrair conteúdo de ${file.name} para indexação.`, severity: 'warning', details: e,
            });
        }
    }
    return fullFileContents;
};

// --- Refactored Service Functions ---

export const generateReportFromFiles = async (
  fileContents: {fileName: string, content: string}[],
  classifications: ClassificationResult[],
  logError: (error: Omit<LogError, 'timestamp'>) => void
): Promise<ExecutiveSummary> => {
    const startTime = performance.now();
    const combinedContent = fileContents.map(f => f.content).join('\n\n');
    const totalTokens = estimateTokens(combinedContent);
    const estimatedRequestTokens = totalTokens + 1000; // Prompt overhead

    // Strategy Selection
    if (estimatedRequestTokens > CHUNK_TOKEN_THRESHOLD && fileContents.length > 1) {
        logError({ source: 'geminiService.executive', message: `Payload grande (${totalTokens} tokens). Iniciando estratégia de map-reduce incremental.`, severity: 'info' });
        
        let incrementalContext = "Iniciando análise em lotes. Nenhum contexto prévio.";
        const partialResults = [];

        for (const file of fileContents) {
            logError({ source: 'geminiService.mapStep', message: `Analisando lote: ${file.fileName}`, severity: 'info' });
            const prompt = `
                Você é um extrator de dados fiscais. Analise o conteúdo do arquivo e o contexto incremental para extrair um objeto JSON com as seguintes métricas.
                Se uma métrica não for encontrada, retorne 0.
                
                [Contexto Incremental da Análise Anterior]
                ${incrementalContext}
                
                [Conteúdo do Arquivo Atual: ${file.fileName}]
                ${file.content}
                
                [Sua Tarefa]
                Responda APENAS com um objeto JSON contendo:
                {
                  "numeroDeDocumentosValidos": number, "valorTotalDasNfes": number, "valorTotalDosProdutos": number,
                  "valorTotalDeICMS": number, "valorTotalDePIS": number, "valorTotalDeCOFINS": number, "valorTotalDeISS": number,
                  "actionableInsight": "Um insight conciso (máx 20 palavras) deste arquivo.",
                  "resumoParaProximoContexto": "Um resumo técnico muito breve (máx 30 palavras) dos achados para informar a próxima análise."
                }
            `;
            const response = await callGeminiThrottled([{text: prompt}], true, logError);
            const result = parseGeminiJsonResponse<any>(response.text, logError);
            partialResults.push(result);
            incrementalContext = result.resumoParaProximoContexto || "Contexto anterior processado.";
        }

        // --- REDUCE STEP ---
        const aggregatedMetrics = partialResults.reduce((acc, summary) => {
            Object.keys(acc).forEach(key => {
                if (typeof summary[key] === 'number') (acc as any)[key] += summary[key];
            });
            return acc;
        }, {
            numeroDeDocumentosValidos: 0, valorTotalDasNfes: 0, valorTotalDosProdutos: 0, valorTotalDeICMS: 0, valorTotalDePIS: 0, valorTotalDeCOFINS: 0, valorTotalDeISS: 0,
        });
        const collectedInsights = partialResults.map(s => s.actionableInsight).filter(Boolean);

        const synthesisPrompt = `
            Você é um especialista em contabilidade fiscal. Com base nos dados agregados e insights, gere o restante do resumo executivo em JSON.
            [Dados Agregados] ${JSON.stringify(aggregatedMetrics, null, 2)}
            [Insights Coletados] - ${collectedInsights.join('\n- ')}
            [Contexto de Classificação] ${JSON.stringify(classifications, null, 2)}
            
            [Sua Tarefa]
            Gere APENAS um objeto JSON com:
            {
              "title": "Um título conciso para o relatório.",
              "description": "Uma breve descrição do período analisado.",
              "indiceDeConformidadeICMS": "Uma porcentagem estimada (ex: '98.7%').",
              "nivelDeRiscoTributario": "'Baixo', 'Média', ou 'Alto'.",
              "actionableInsights": [ { "text": "Refine e consolide os insights em 2-4 pontos." } ]
            }
        `;
        const response = await callGeminiThrottled([{text: synthesisPrompt}], true, logError);
        const textualPart = parseGeminiJsonResponse<any>(response.text, logError);
        
        const finalSummary: ExecutiveSummary = {
            ...textualPart,
            keyMetrics: { ...aggregatedMetrics, indiceDeConformidadeICMS: textualPart.indiceDeConformidadeICMS, nivelDeRiscoTributario: textualPart.nivelDeRiscoTributario, estimativaDeNVA: 0 },
        };
        // FIX: The 'title' property exists on 'finalSummary', not on 'finalSummary.keyMetrics'.
        if (!finalSummary?.title) throw new Error("A estrutura do resumo sintetizado é inválida.");
        logError({ source: 'geminiService.executive', message: `Análise em lotes concluída em ${(performance.now() - startTime).toFixed(0)} ms.`, severity: 'info' });
        return finalSummary;

    } else {
        // --- Original Logic for smaller payloads ---
        logError({ source: 'geminiService.executive', message: `Payload pequeno (${totalTokens} tokens). Usando análise unificada.`, severity: 'info' });
        const prompt = `
          Você é um especialista em contabilidade e análise fiscal no Brasil. Analise o conteúdo fiscal e o contexto de classificação fornecidos para gerar UM RESUMO EXECUTIVO.
          [Contexto de Classificação] ${JSON.stringify(classifications, null, 2)}
          [Conteúdo dos Arquivos] ${combinedContent}

          [Sua Tarefa]
          Responda APENAS com um objeto JSON para a chave "executiveSummary" com a seguinte estrutura:
          {
            "title": "Análise Fiscal Consolidada de...",
            "description": "Breve descrição dos documentos analisados.",
            "keyMetrics": {
              "numeroDeDocumentosValidos": number, "valorTotalDasNfes": number, "valorTotalDosProdutos": number,
              "indiceDeConformidadeICMS": "string (ex: '98.7%')", "nivelDeRiscoTributario": "'Baixo' | 'Média' | 'Alto'",
              "estimativaDeNVA": 0, "valorTotalDeICMS": number, "valorTotalDePIS": number, "valorTotalDeCOFINS": number, "valorTotalDeISS": number
            },
            "actionableInsights": [ { "text": "string" } ],
            "csvInsights": [ { "fileName": "string", "insight": "string", "rowCount": number } ]
          }
        `;
        const response = await callGeminiThrottled([{text: prompt}], true, logError);
        const report = parseGeminiJsonResponse<{ executiveSummary: ExecutiveSummary }>(response.text, logError);
        if (!report?.executiveSummary?.keyMetrics) throw new Error("A estrutura do resumo executivo da IA é inválida.");
        logError({ source: 'geminiService.executive', message: `Análise unificada concluída em ${(performance.now() - startTime).toFixed(0)} ms.`, severity: 'info' });
        return report.executiveSummary;
    }
};

// Other analysis functions (fullText, comparative, simulate) would be refactored similarly,
// applying the same sequential, throttled, and incremental context pattern.
// For brevity, only the main report generation is fully refactored here.

export const generateFullTextAnalysis = async (
    files: File[], logError: (error: Omit<LogError, 'timestamp'>) => void, onProgress: (message: string) => void
): Promise<string> => {
    onProgress('Extraindo conteúdo para análise completa...');
    const fileContents = await getFileContentForAnalysis(files, () => {}, logError);
    let combinedAnalysis = "# Análise Textual Completa\n\n";
    let incrementalContext = "Iniciando análise textual detalhada.";
    
    for (let i = 0; i < fileContents.length; i++) {
        const file = fileContents[i];
        onProgress(`Analisando arquivo ${i + 1}/${fileContents.length}: ${file.fileName}`);
        const prompt = `
            Você é um analista fiscal. Forneça uma análise textual detalhada em markdown do documento fiscal abaixo.
            [Contexto da Análise Anterior] ${incrementalContext}
            [Conteúdo do Arquivo Atual: ${file.fileName}] ${file.content}
            [Sua Tarefa]
            Gere a análise para o arquivo atual e um resumo técnico (máx 30 palavras) para o próximo contexto.
            Responda APENAS com um JSON: { "analise": "sua análise em markdown aqui", "resumoParaProximoContexto": "seu resumo aqui" }
        `;
        try {
            const response = await callGeminiThrottled([{ text: prompt }], true, logError);
            const result = parseGeminiJsonResponse<{ analise: string, resumoParaProximoContexto: string }>(response.text, logError);
            combinedAnalysis += `## Análise do Arquivo: ${file.fileName}\n\n${result.analise}\n\n---\n\n`;
            incrementalContext = result.resumoParaProximoContexto;
        } catch (chunkError) {
            combinedAnalysis += `## Análise do Arquivo: ${file.fileName}\n\n**ERRO:** Não foi possível gerar a análise para este arquivo.\n\n---\n\n`;
        }
    }
    return combinedAnalysis;
};

export const simulateTaxScenario = async (
    calculatedScenarios: TaxScenario[], logError: (error: Omit<LogError, 'timestamp'>) => void
): Promise<SimulationResult> => {
    const scenariosForAI = calculatedScenarios.map(({ recomendacoes, ...scenario }) => scenario);
    const prompt = `
        Você é um consultor fiscal sênior. Com base nos CÁLCULOS de cenários tributários, gere a análise textual.
        [Dados Calculados] ${JSON.stringify(scenariosForAI, null, 2)}
        [Sua Tarefa]
        Responda APENAS com um JSON contendo:
        {
          "resumoExecutivo": "Um parágrafo conciso resumindo os resultados.",
          "recomendacaoPrincipal": "O nome do cenário mais vantajoso (ex: 'Lucro Presumido').",
          "recomendacoesPorCenario": { "NomeDoCenario": ["recomendação 1", "recomendação 2"] }
        }
    `;
    const response = await callGeminiThrottled([{ text: prompt }], true, logError);
    const textualAnalysis = parseGeminiJsonResponse<any>(response.text, logError);
    if (!textualAnalysis?.recomendacoesPorCenario) throw new Error("A estrutura da análise textual da simulação é inválida.");
    
    const finalScenarios = calculatedScenarios.map(scenario => ({
        ...scenario,
        recomendacoes: textualAnalysis.recomendacoesPorCenario[scenario.nome] || [],
    }));
    
    return {
        resumoExecutivo: textualAnalysis.resumoExecutivo,
        recomendacaoPrincipal: textualAnalysis.recomendacaoPrincipal,
        cenarios: finalScenarios
    };
};

export const generateComparativeAnalysis = async (
    files: File[], logError: (error: Omit<LogError, 'timestamp'>) => void, onProgress: (message: string) => void
): Promise<ComparativeAnalysisReport> => {
    onProgress('Extraindo conteúdo para comparação...');
    const fileContents = await getFileContentForAnalysis(files, () => {}, logError);
    
    let incrementalContext = "Iniciando análise comparativa.";
    const summaries = [];

    for (let i = 0; i < fileContents.length; i++) {
        const file = fileContents[i];
        onProgress(`Resumindo arquivo ${i + 1}/${fileContents.length}: ${file.fileName}`);
        const prompt = `
          Extraia as métricas e características chave do documento em JSON. Seja conciso.
          [Contexto Anterior] ${incrementalContext}
          [Conteúdo Atual: ${file.fileName}] ${file.content}
          [Sua Tarefa] Responda com um JSON: { "resumo": { ...dados chave }, "resumoParaProximoContexto": "resumo técnico de 20 palavras" }
        `;
        const response = await callGeminiThrottled([{text: prompt}], true, logError);
        const result = parseGeminiJsonResponse<any>(response.text, logError);
        summaries.push({ fileName: file.fileName, summary: result.resumo });
        incrementalContext = result.resumoParaProximoContexto;
    }

    onProgress('Sintetizando o relatório comparativo...');
    const synthesisPrompt = `
        Você é um analista fiscal comparativo. Com base nos resumos, gere um relatório comparativo.
        [Resumos dos Arquivos] ${JSON.stringify(summaries, null, 2)}
        [Sua Tarefa]
        Gere APENAS um objeto JSON com a estrutura:
        {
          "executiveSummary": "Resumo das principais diferenças e anomalias.",
          "keyComparisons": [ { "metricName": string, "valueFileA": string, "valueFileB": string, "variance": string, "comment": string } ],
          "identifiedPatterns": [ { "description": string, "foundIn": string[] } ],
          "anomaliesAndDiscrepancies": [ { "fileName": string, "description": string, "severity": "'Baixa' | 'Média' | 'Alta'" } ]
        }
    `;
    const finalResponse = await callGeminiThrottled([{ text: synthesisPrompt }], true, logError);
    const analysisResult = parseGeminiJsonResponse<ComparativeAnalysisReport>(finalResponse.text, logError);
    if (!analysisResult?.keyComparisons) throw new Error("A estrutura do relatório comparativo é inválida.");
    return analysisResult;
};

export const convertFilesToGeminiParts = async (files: File[]): Promise<Part[]> => {
    const fileToGenerativePart = async (file: File): Promise<Part | null> => {
        const allowedImageTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedImageTypes.includes(file.type)) return null;
        const base64EncodedData = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
        return { inlineData: { data: base64EncodedData, mimeType: file.type } };
    };
    
    const fileProcessingPromises = files.map(async (file) => {
        if (file.type.startsWith('image/')) return fileToGenerativePart(file);
        const parsedResult = await parseFile(file, () => {});
        return { text: `\n--- START FILE: ${file.name} ---\n${parsedResult.content}\n--- END FILE: ${file.name} ---\n` };
    });

    const results = await Promise.all(fileProcessingPromises);
    return results.filter((p): p is Part => p !== null);
};

export const getChatCompletion = async (
    prompt: string, logError: (error: Omit<LogError, 'timestamp'>) => void
): Promise<string> => {
    const response = await callGeminiThrottled([{ text: prompt }], false, logError);
    return response.text;
};