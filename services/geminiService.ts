import { GoogleGenAI } from "@google/genai";
import {
  GeneratedReport,
  SimulationParams,
  SimulationResult,
  ComparativeAnalysisReport,
} from '../types.ts';

// Fix: Initialize the GoogleGenAI client.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

/**
 * Parses a JSON object from a string, which may be wrapped in a markdown code block.
 * Includes fallbacks for common formatting issues.
 * @param jsonString The string to parse.
 * @returns The parsed object or null if parsing fails.
 */
const parseJsonFromMarkdown = <T>(jsonString: string): T | null => {
    try {
        const match = jsonString.match(/```json\n([\s\S]*?)\n```/);
        if (match && match[1]) {
            return JSON.parse(match[1]) as T;
        }
        // Fallback for cases where the JSON is not in a markdown block
        return JSON.parse(jsonString) as T;
    } catch (error) {
        console.error("Failed to parse JSON from response:", error);
        console.error("Original string:", jsonString);
        // Attempt to fix common JSON errors, like trailing commas
        try {
            const sanitizedString = jsonString
                .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
                .match(/\{[\s\S]*\}/)?.[0]; // extract the main object
            if(sanitizedString) {
                return JSON.parse(sanitizedString) as T;
            }
        } catch (e) {
             console.error("Failed to parse sanitized JSON:", e);
        }
        return null;
    }
};

/**
 * Generates a comprehensive fiscal and accounting report from a set of files.
 * @param files The files to analyze.
 * @param onProgressUpdate A callback to report progress through the pipeline.
 * @returns A promise that resolves to the generated report.
 */
export const generateReportFromFiles = async (
  files: File[],
  onProgressUpdate: (stepIndex: number) => void
): Promise<GeneratedReport> => {
  onProgressUpdate(0); // 1. Extração e Leitura

  const fileContents = await Promise.all(
    files.map(async (file) => {
      if (file.type.startsWith('text/') || file.type.includes('xml') || file.name.toLowerCase().endsWith('.csv')) {
        const content = await file.text();
        return `
        --- INÍCIO DO ARQUIVO: ${file.name} ---
        ${content.substring(0, 5000)}... (conteúdo truncado para análise)
        --- FIM DO ARQUIVO: ${file.name} ---
        `;
      }
      return `--- ARQUIVO (não textual): ${file.name} ---`;
    })
  );

  onProgressUpdate(1); // 2. Ag. Auditor
  await new Promise(res => setTimeout(res, 500)); // Simulate work
  onProgressUpdate(2); // 3. Ag. Classificador
  await new Promise(res => setTimeout(res, 500)); // Simulate work
  onProgressUpdate(3); // 4. Ag. Inteligência
  
  const prompt = `
    # Análise Fiscal e Contábil Abrangente

    ## Contexto
    Você é o "Nexus QuantumI2A2", um sistema de IA especialista em análise fiscal e contábil para empresas brasileiras. Você recebeu ${files.length} arquivos para análise. Os nomes dos arquivos são: ${files.map(f => f.name).join(', ')}.

    ## Tarefa
    Sua tarefa é realizar uma análise completa dos arquivos fornecidos e gerar um relatório estruturado em formato JSON. O relatório deve ser dividido em duas partes principais: "executiveSummary" e "fullTextAnalysis".

    ### 1. Resumo Executivo (executiveSummary)
    Esta seção deve conter uma visão geral concisa e acionável. Crie um objeto JSON com a seguinte estrutura:

    - **title**: "Relatório de Análise Fiscal e Contábil"
    - **description**: Um resumo de 1-2 frases sobre os arquivos analisados.
    - **keyMetrics**: Um objeto com as seguintes métricas-chave, extraídas e calculadas a partir dos documentos. Se um valor não puder ser determinado, use 0 ou uma estimativa razoável.
        - **numeroDeDocumentosValidos**: (Integer) Contagem total de documentos fiscais válidos encontrados.
        - **valorTotalDasNfes**: (Float) Soma total dos valores de todas as Notas Fiscais Eletrônicas (NF-e).
        - **valorTotalDosProdutos**: (Float) Soma total do valor dos produtos/serviços.
        - **indiceDeConformidadeICMS**: (String, e.g., "98.7%") Estimativa da porcentagem de transações em conformidade com as regras de ICMS.
        - **nivelDeRiscoTributario**: (Enum: "Baixo", "Médio", "Alto") Avaliação geral do risco fiscal com base nas anomalias encontradas.
        - **estimativaDeNVA**: (Float) Estimativa da "Necessidade de Verba de Antecipação" (NVA), se aplicável.
        - **valorTotalDeICMS**: (Float) Soma total de ICMS.
        - **valorTotalDePIS**: (Float) Soma total de PIS.
        - **valorTotalDeCOFINS**: (Float) Soma total de COFINS.
        - **valorTotalDeISS**: (Float) Soma total de ISS.
    - **actionableInsights**: Uma array de objetos, cada um com uma chave "text" (String). Forneça 2-3 insights práticos e acionáveis baseados na análise.
    - **csvInsights**: Se houver arquivos CSV, forneça uma análise resumida para cada um. É uma array de objetos com a seguinte estrutura:
        - **fileName**: (String) O nome do arquivo CSV.
        - **insight**: (String) Um resumo de uma frase sobre o conteúdo do arquivo CSV.
        - **rowCount**: (Integer) O número de linhas no arquivo.

    ### 2. Análise Textual Completa (fullTextAnalysis)
    Esta seção deve ser uma string de texto corrido (não JSON) com uma análise detalhada. Organize o texto com títulos e parágrafos. Cubra os seguintes pontos:
    - **Visão Geral dos Documentos**: Descreva os tipos de documentos encontrados e o período que cobrem.
    - **Análise de Conformidade**: Detalhe os pontos de conformidade e não conformidade encontrados (ICMS, PIS/COFINS, etc.).
    - **Identificação de Riscos**: Elabore sobre os riscos fiscais identificados e suas possíveis consequências.
    - **Oportunidades de Otimização**: Sugira áreas onde a empresa pode otimizar sua carga tributária ou melhorar seus processos fiscais.
    - **Conclusão**: Um parágrafo final resumindo os achados.

    ## Conteúdo dos Arquivos
    ${fileContents.join('\n')}

    ## Formato de Saída
    Responda APENAS com o objeto JSON contendo 'executiveSummary' e 'fullTextAnalysis'. O JSON deve estar dentro de um bloco de código markdown (\`\`\`json ... \`\`\`).
    Não adicione nenhum texto ou explicação antes ou depois do bloco de código JSON.
  `;
  
  const model = "gemini-2.5-flash";
  
  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: prompt }] }],
  });

  onProgressUpdate(4); // 5. Ag. Contador

  const reportText = response.text;
  const parsedReport = parseJsonFromMarkdown<GeneratedReport>(reportText);
  
  if (!parsedReport || !parsedReport.executiveSummary || !parsedReport.fullTextAnalysis) {
      console.error("Failed to parse report from Gemini response:", reportText);
      throw new Error("Não foi possível gerar o relatório. A resposta da IA está em um formato inesperado. Verifique os logs para mais detalhes.");
  }
  
  return parsedReport;
};

/**
 * Simulates tax scenarios based on user parameters and a baseline report.
 * @param params The simulation parameters.
 * @param report The baseline generated report.
 * @returns A promise that resolves to the simulation result.
 */
export const simulateTaxScenario = async (
    params: SimulationParams,
    report: GeneratedReport
): Promise<SimulationResult> => {
    
    const prompt = `
    # Simulação de Cenário Tributário

    ## Contexto
    Você é um especialista em planejamento tributário no Brasil. Um cliente forneceu dados de um relatório fiscal e parâmetros para uma simulação. Seu trabalho é analisar os dados e gerar 3 cenários tributários, comparando-os e fornecendo uma recomendação.

    ## Dados do Relatório de Análise (Contexto Base)
    - **Valor Base para Simulação (Faturamento/Receita Bruta):** ${params.valorBase}
    - **Métricas Chave do Período Anterior:** ${JSON.stringify(report.executiveSummary.keyMetrics)}

    ## Parâmetros da Simulação
    - **Regime Tributário de Referência:** ${params.regimeTributario}
    - **UF de Operação:** ${params.uf}
    - **CNAE Principal:** ${params.cnae}
    - **Tipo de Operação:** ${params.tipoOperacao}

    ## Tarefa
    Gere uma simulação tributária em formato JSON. A resposta DEVE seguir estritamente a estrutura abaixo.
    Crie três cenários:
    1.  O cenário baseado nos parâmetros fornecidos (${params.regimeTributario}).
    2.  Um cenário alternativo (ex: se o regime for Lucro Presumido, crie um para Lucro Real ou Simples Nacional).
    3.  Um terceiro cenário, otimizado ou com alguma variação (ex: em outra UF, ou com benefício fiscal).

    ## Estrutura JSON de Saída
    Responda APENAS com o objeto JSON abaixo, dentro de um bloco de código markdown (\`\`\`json ... \`\`\`).

    {
      "resumoExecutivo": "(String) Um resumo de 2-3 frases explicando os resultados da simulação e a principal conclusão.",
      "recomendacaoPrincipal": "(String) O nome do cenário recomendado (deve corresponder a um dos 'nome' nos cenários abaixo).",
      "cenarios": [
        {
          "nome": "(String) Nome do cenário (ex: 'Lucro Presumido - SP')",
          "parametros": {
            "regime": "(String) Regime tributário do cenário",
            "uf": "(String) UF do cenário"
          },
          "cargaTributariaTotal": "(Float) Valor total de impostos a pagar neste cenário.",
          "aliquotaEfetiva": "(String, e.g., '14.53%') A alíquota efetiva (Carga Total / Valor Base).",
          "impostos": {
            "IRPJ": "(Float) Valor estimado.",
            "CSLL": "(Float) Valor estimado.",
            "PIS": "(Float) Valor estimado.",
            "COFINS": "(Float) Valor estimado.",
            "ICMS": "(Float) Valor estimado.",
            "ISS": "(Float) Valor estimado.",
            "CPP (INSS)": "(Float) Valor estimado da Contribuição Previdenciária Patronal.",
            "IPI": "(Float, opcional) Valor estimado se aplicável."
          },
          "recomendacoes": [
            "(String) Uma recomendação específica para este cenário.",
            "(String) Outra recomendação."
          ]
        }
      ]
    }
    `;

    const model = 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
    });

    const resultText = response.text;
    const parsedResult = parseJsonFromMarkdown<SimulationResult>(resultText);

    if (!parsedResult || !parsedResult.cenarios || parsedResult.cenarios.length === 0) {
        console.error("Failed to parse simulation result from Gemini response:", resultText);
        throw new Error("Não foi possível gerar a simulação. A resposta da IA está em um formato inesperado.");
    }

    return parsedResult;
};

/**
 * Generates a comparative analysis between multiple files.
 * @param files The files to compare.
 * @returns A promise that resolves to the comparative analysis report.
 */
export const generateComparativeAnalysis = async (files: File[]): Promise<ComparativeAnalysisReport> => {
    if (files.length < 2) {
        throw new Error("A análise comparativa requer pelo menos 2 arquivos.");
    }
    const fileContents = await Promise.all(
        files.map(async (file) => {
          if (file.type.startsWith('text/') || file.type.includes('xml') || file.name.toLowerCase().endsWith('.csv')) {
            const content = await file.text();
            return `
            --- INÍCIO DO ARQUIVO: ${file.name} ---
            ${content.substring(0, 5000)}... (conteúdo truncado)
            --- FIM DO ARQUIVO: ${file.name} ---
            `;
          }
          return `--- ARQUIVO (não textual): ${file.name} ---`;
        })
    );

    const prompt = `
    # Análise Comparativa de Documentos Fiscais

    ## Contexto
    Você é um auditor de IA avançado. Você recebeu ${files.length} arquivos para uma análise comparativa. Os nomes dos arquivos são: ${files.map(f => f.name).join(', ')}.

    ## Tarefa
    Compare os arquivos e gere um relatório de análise comparativa em formato JSON. O objetivo é identificar variações, padrões, anomalias e discrepâncias entre os conjuntos de dados.

    ## Estrutura JSON de Saída
    Responda APENAS com o objeto JSON abaixo, dentro de um bloco de código markdown (\`\`\`json ... \`\`\`).

    {
        "executiveSummary": "(String) Um resumo de 2-3 frases sobre as principais descobertas da comparação.",
        "keyComparisons": [
            {
                "metricName": "(String) Nome da métrica chave comparada (ex: 'Valor Total NF-e', 'Alíquota Média ICMS').",
                "valueFileA": "(String) Valor no primeiro arquivo/grupo.",
                "valueFileB": "(String) Valor no segundo arquivo/grupo.",
                "variance": "(String) A variação percentual ou absoluta (ex: '+15.2%', '-R$ 5.432,10').",
                "comment": "(String) Um breve comentário sobre o significado da variação."
            }
        ],
        "identifiedPatterns": [
            {
                "description": "(String) Descrição de um padrão recorrente observado (ex: 'Uso consistente do CFOP 5102 para vendas estaduais').",
                "foundIn": ["(String) Array com os nomes dos arquivos onde o padrão foi encontrado."]
            }
        ],
        "anomaliesAndDiscrepancies": [
            {
                "fileName": "(String) Nome do arquivo onde a anomalia foi encontrada.",
                "description": "(String) Descrição clara da anomalia ou discrepância (ex: 'NF-e com valor de ICMS zerado para operação tributável').",
                "severity": "(Enum: 'Baixa', 'Média', 'Alta') A severidade do risco associado."
            }
        ]
    }
    
    ## Conteúdo dos Arquivos
    ${fileContents.join('\n')}
    `;
    
    const model = 'gemini-2.5-flash';
    const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text: prompt }] }],
    });

    const resultText = response.text;
    const parsedResult = parseJsonFromMarkdown<ComparativeAnalysisReport>(resultText);

    if (!parsedResult || !parsedResult.executiveSummary || !parsedResult.keyComparisons) {
        console.error("Failed to parse comparative analysis from Gemini response:", resultText);
        throw new Error("Não foi possível gerar a análise comparativa. Resposta da IA inválida.");
    }
    
    return parsedResult;
};
