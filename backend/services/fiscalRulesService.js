// backend/services/fiscalRulesService.js
/**
 * Serviço centralizado para fornecer regras de negócio, fiscais e contábeis.
 * Externaliza a lógica que antes estava hardcoded nos agentes, melhorando
 * a manutenibilidade e a adaptabilidade do sistema.
 */

// === PARÂMETROS DE RISCO E AUDITORIA (usado no auditAgent) ===
const RISK_THRESHOLDS = {
    HIGH_VALUE_DOCUMENT: parseFloat(process.env.AUDIT_HIGH_VALUE_THRESHOLD || '100000'),
    // Outros limiares podem ser adicionados aqui
};

// === PARÂMETROS DE CLASSIFICAÇÃO (usado no classificationAgent) ===
const CLASSIFICATION = {
    OPERATION_TYPES: ['compra', 'venda', 'serviço', 'desconhecido'],
    SECTORS: ['agronegócio', 'indústria', 'varejo', 'transporte', 'outros'],

    inferOperationFromCfop(cfops = []) {
        if (!cfops.length) return null;
        if (cfops.some(code => /^[56]/.test(code))) return 'venda';
        if (cfops.some(code => /^[12]/.test(code))) return 'compra';
        if (cfops.some(code => /^[37]/.test(code))) return 'serviço';
        return null;
    },

    inferSectorFromNcm(ncms = []) {
        for (const code of ncms) {
            if (/^(0[1-3])/.test(code)) return 'agronegócio';
            if (/^(84|85|86)/.test(code)) return 'indústria';
            if (/^(87|88|89|90)/.test(code)) return 'transporte';
            if (/^(39|48|49|64)/.test(code)) return 'varejo';
        }
        return null;
    },
};

// === PARÂMETROS DE CONTABILIZAÇÃO (usado no accountingAutomation) ===
const ACCOUNTING = {
    // Plano de Contas Simplificado
    CHART_OF_ACCOUNTS: {
        REVENUE: 'Receita de Vendas/Serviços',
        COGS: 'Custo da Mercadoria Vendida',
        INVENTORY: 'Estoque de Mercadorias',
        ACCOUNTS_RECEIVABLE: 'Clientes a Receber',
        ACCOUNTS_PAYABLE: 'Fornecedores a Pagar',
        TAXES_ICMS: 'ICMS a Recolher',
        TAXES_PIS: 'PIS a Recolher',
        TAXES_COFINS: 'COFINS a Recolher',
        BANK: 'Caixa/Bancos',
        MANUAL_ADJUSTMENT: 'Ajuste Manual',
    },

    /**
     * Inferencia de contas contábeis com base no CFOP.
     * Esta lógica é uma simplificação e em um sistema real seria muito mais complexa.
     * @param {string} cfop Código Fiscal de Operações e Prestações
     * @returns {{debit: string, credit: string}} Contas de débito e crédito sugeridas.
     */
    inferAccountsFromCfop(cfop = '') {
        const { REVENUE, INVENTORY, ACCOUNTS_RECEIVABLE, ACCOUNTS_PAYABLE, MANUAL_ADJUSTMENT } = this.CHART_OF_ACCOUNTS;
        if (!cfop) return { debit: MANUAL_ADJUSTMENT, credit: MANUAL_ADJUSTMENT };

        const firstDigit = cfop.charAt(0);

        // Vendas e Serviços (Saídas)
        if (['5', '6', '7'].includes(firstDigit)) {
            return { debit: ACCOUNTS_RECEIVABLE, credit: REVENUE };
        }
        // Compras e Entradas
        if (['1', '2', '3'].includes(firstDigit)) {
            return { debit: INVENTORY, credit: ACCOUNTS_PAYABLE };
        }

        return { debit: MANUAL_ADJUSTMENT, credit: MANUAL_ADJUSTMENT };
    }
};


module.exports = {
    RISK_THRESHOLDS,
    CLASSIFICATION,
    ACCOUNTING,
};
