// backend/services/accountingAutomation.js
/**
 * Utilidades para gerar lançamentos contábeis automáticos a partir
 * dos documentos fiscais já validados no pipeline.
 */

function inferAccounts(cfop = '', role = 'emit') {
    if (!cfop) return { debit: 'Ajuste Manual', credit: 'Ajuste Manual' };
    const prefix = cfop.charAt(0);

    if (['5', '6', '7'].includes(prefix)) {
        return {
            debit: role === 'emit' ? 'Clientes a Receber' : 'Duplicatas a Pagar',
            credit: 'Receita de Vendas/Serviços',
        };
    }
    if (['1', '2', '3'].includes(prefix)) {
        return {
            debit: 'Estoque de Mercadorias',
            credit: role === 'emit' ? 'Clientes a Receber' : 'Fornecedores a Pagar',
        };
    }
    return {
        debit: 'Despesas/Custos Diversos',
        credit: 'Caixa/Bancos',
    };
}

function suggestAccountingEntries(documents = []) {
    const entries = [];

    documents.forEach((doc) => {
        const cfop = doc?.itens?.[0]?.cfop;
        const totalInvoice = Number(doc?.total?.vNF || 0);
        const { debit, credit } = inferAccounts(cfop, 'emit');

        entries.push({
            data: doc?.ide?.dhEmi,
            descricao: `NF-e ${doc?.ide?.nNF} | ${doc?.emit?.xNome}`,
            cfop,
            conta_debito: debit,
            conta_credito: credit,
            valor: Number(totalInvoice.toFixed(2)),
            historico: `Lançamento automático da NF-e ${doc?.chave}`,
        });

        const valorICMS = Number(doc?.total?.vICMS || 0);
        if (valorICMS > 0) {
            entries.push({
                data: doc?.ide?.dhEmi,
                descricao: `ICMS NF-e ${doc?.ide?.nNF}`,
                cfop,
                conta_debito: 'ICMS a Recolher',
                conta_credito: 'ICMS sobre Vendas',
                valor: Number(valorICMS.toFixed(2)),
                historico: `Ajuste de ICMS para a NF-e ${doc?.chave}`,
            });
        }
    });

    return entries;
}

function entriesToCsv(data = []) {
    if (!data.length) return '';
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
