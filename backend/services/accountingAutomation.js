// backend/services/accountingAutomation.js
const { ACCOUNTING } = require('./fiscalRulesService');

/**
 * Utilidades para gerar lançamentos contábeis automáticos a partir
 * dos documentos fiscais já validados no pipeline.
 */

function suggestAccountingEntries(documents = []) {
    const entries = [];
    const { CHART_OF_ACCOUNTS, inferAccountsFromCfop } = ACCOUNTING;

    documents.forEach((doc) => {
        const cfop = doc?.itens?.[0]?.cfop;
        const totalInvoice = Number(doc?.total?.vNF || 0);
        // A lógica de inferência agora é chamada do serviço centralizado
        const { debit, credit } = inferAccountsFromCfop.call(ACCOUNTING, cfop);

        entries.push({
            data: doc?.ide?.dhEmi,
            descricao: `NF-e ${doc?.ide?.nNF} | ${doc?.emit?.xNome}`,
            cfop,
            conta_debito: debit,
            conta_credito: credit,
            valor: Number(totalInvoice.toFixed(2)),
            historico: `Lançamento automático da NF-e ${doc?.chave}`,
        });

        // Utiliza o plano de contas centralizado para os impostos
        const valorICMS = Number(doc?.total?.vICMS || 0);
        if (valorICMS > 0) {
            entries.push({
                data: doc?.ide?.dhEmi,
                descricao: `ICMS NF-e ${doc?.ide?.nNF}`,
                cfop,
                conta_debito: CHART_OF_ACCOUNTS.TAXES_ICMS,
                conta_credito: 'ICMS sobre Vendas', // Exemplo, poderia ser outra conta
                valor: Number(valorICMS.toFixed(2)),
                historico: `Ajuste de ICMS para a NF-e ${doc?.chave}`,
            });
        }
    });

    return entries;
}

function entriesToCsv(data = []) {
    if (!data || !data.length) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((row) =>
        headers
            .map((key) => {
                const value = row[key] ?? '';
                const safe = String(value).replace(/"/g, '""');
                return `"${safe}"`;
            })
            .join(',')
    );
    return `${headers.join(',')}\n${rows.join('\n')}`;
}

module.exports = {
    suggestAccountingEntries,
    entriesToCsv,
};
