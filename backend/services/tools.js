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

module.exports = { tax_simulation, cnpj_validation };
