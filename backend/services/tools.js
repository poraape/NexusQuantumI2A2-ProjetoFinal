// backend/services/tools.js
const { getCnpjData } = require('./brasilAPI');
const redisClient = require('./redisClient');

/**
 * Simulates a tax calculation. In a real-world scenario, this would contain
 * complex business logic.
 * @param {object} params - The parameters for the simulation.
 * @param {number} params.baseValue - The base value for calculation.
 * @param {string} params.taxRegime - The tax regime ('Lucro Presumido', 'Lucro Real', etc.).
 * @returns {Promise<object>} The result of the simulation.
 */
async function tax_simulation({ baseValue, taxRegime }) {
    console.log(`[ToolsAgent] Executing tax_simulation with baseValue: ${baseValue} and taxRegime: ${taxRegime}`);
    // This is a simplified simulation logic.
    const taxRate = taxRegime === 'Lucro Real' ? 0.34 : 0.15;
    const totalTax = baseValue * taxRate;

    return {
        success: true,
        details: {
            regime: taxRegime,
            baseValue: baseValue,
            calculatedTax: totalTax,
            effectiveRate: `${(taxRate * 100).toFixed(2)}%`,
        }
    };
}

/**
 * Validates a CNPJ using an external API.
 * @param {object} params
 * @param {string} params.cnpj The CNPJ to validate.
 * @returns {Promise<object>} The validation result.
 */
async function cnpj_validation({ cnpj }) {
    console.log(`[ToolsAgent] Executing cnpj_validation for: ${cnpj}`);
    const cleanedCnpj = cnpj.replace(/\D/g, ''); // Remove non-digit characters
    const cacheKey = `cnpj_validation:${cleanedCnpj}`;
    try {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (err) {
        console.warn('[ToolsAgent] Falha ao consultar cache redis para CNPJ.', err);
    }

    const result = await getCnpjData(cleanedCnpj);

    try {
        const ttl = parseInt(process.env.CNPJ_CACHE_TTL_SECONDS || '604800', 10); // default 7 days
        await redisClient.set(cacheKey, JSON.stringify(result), { EX: ttl });
    } catch (err) {
        console.warn('[ToolsAgent] Falha ao armazenar cache de CNPJ.', err);
    }

    return result;
}

/**
 * Simulates a RAG query to a vector database of fiscal legislation.
 * @param {object} params
 * @param {string} params.query The fiscal topic to consult.
 * @returns {Promise<object>} The retrieved legal information.
 */
async function consult_fiscal_legislation({ query }) {
    console.log(`[ToolsAgent] Executing consult_fiscal_legislation for query: "${query}"`);
    
    // In a real system, this would perform a vector search.
    // Here, we return a hardcoded, relevant-sounding text block.
    const knowledgeBase = {
        "crédito presumido": "O Art. 15, § 2º da Lei Complementar 87/96 (Lei Kandir) estabelece que o crédito presumido de ICMS é um benefício fiscal que substitui o sistema normal de creditamento, sendo opcional ao contribuinte e dependente de regulamentação estadual.",
        "diferencial de alíquota": "O Diferencial de Alíquotas (DIFAL), previsto na Emenda Constitucional 87/2015, aplica-se a operações interestaduais destinadas a consumidor final não contribuinte do ICMS. A responsabilidade pelo recolhimento é do remetente.",
        "substituição tributária": "A Substituição Tributária (ST) do ICMS, conforme Art. 150, § 7º da CF/88, atribui a um contribuinte da cadeia (o substituto) a responsabilidade pelo recolhimento do imposto devido pelos demais (os substituídos).",
    };

    const lowerQuery = query.toLowerCase();
    const foundKey = Object.keys(knowledgeBase).find(key => lowerQuery.includes(key));
    
    const resultText = foundKey 
        ? knowledgeBase[foundKey]
        : "Nenhuma informação encontrada na base de conhecimento para a consulta especificada. Tente termos como 'crédito presumido', 'diferencial de alíquota' ou 'substituição tributária'.";

    return {
        success: true,
        source: "Base de Conhecimento Fiscal (Simulada)",
        retrieved_text: resultText,
    };
}


module.exports = { tax_simulation, cnpj_validation, consult_fiscal_legislation };
