// backend/services/reconciliation.js
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const exporter = require('./exporter');

function parseOfx(content) {
    const text = content.toString('utf8');
    const blocks = text.split(/<STMTTRN>/i).slice(1);
    const transactions = [];
    blocks.forEach((block) => {
        const amountMatch = block.match(/<TRNAMT>([-+]?[\d.,]+)/i);
        const dateMatch = block.match(/<DTPOSTED>(\d{8})/i);
        const memoMatch = block.match(/<MEMO>(.+)/i);
        if (!amountMatch || !dateMatch) return;
        const amount = Number(amountMatch[1].replace(',', '.'));
        const date = dateMatch[1];
        const memo = memoMatch ? memoMatch[1].trim() : 'Transação OFX';
        transactions.push({
            date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
            description: memo,
            amount,
        });
    });
    return transactions;
}

function parseCsv(content) {
    const parsed = parse(content, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        trim: true,
    });
    return parsed.map((row) => ({
        date: row.date || row.data || row['data_lancamento'] || row['Data'],
        description: row.description || row.historico || row['Descrição'] || row['historico'],
        amount: Number(String(row.amount || row.valor || row['Valor']).replace(',', '.')),
    }));
}

async function parseStatements(files = []) {
    const statements = [];
    for (const file of files) {
        const buffer = await fs.promises.readFile(file.path);
        try {
            if (file.originalname.toLowerCase().endsWith('.ofx')) {
                statements.push(...parseOfx(buffer));
            } else {
                statements.push(...parseCsv(buffer));
            }
        } finally {
            fs.promises.unlink(file.path).catch(() => {});
        }
    }
    return statements.filter((tx) => Number.isFinite(tx.amount));
}

function reconcile(documents = [], transactions = [], tolerance = 0.5) {
    const invoices = documents.map((doc) => {
        const total = Number(doc?.total?.vNF || doc.valorImpostos || 0);
        return {
            chave: doc?.chave,
            numero: doc?.ide?.nNF,
            valor: Number(total.toFixed(2)),
            emitente: doc?.emit?.xNome,
            destino: doc?.dest?.xNome,
        };
    });

    const remainingInvoices = [...invoices];
    const matches = [];
    const unmatchedTransactions = [];

    transactions.forEach((tx) => {
        const idx = remainingInvoices.findIndex(
            (invoice) => Math.abs(invoice.valor - tx.amount) <= tolerance
        );
        if (idx >= 0) {
            const [invoice] = remainingInvoices.splice(idx, 1);
            matches.push({
                invoice,
                transaction: tx,
            });
        } else {
            unmatchedTransactions.push(tx);
        }
    });

    return {
        summary: {
            totalInvoices: invoices.length,
            totalTransactions: transactions.length,
            reconciled: matches.length,
            pendingInvoices: remainingInvoices.length,
            pendingTransactions: unmatchedTransactions.length,
        },
        matches,
        pendingInvoices: remainingInvoices,
        pendingTransactions: unmatchedTransactions,
    };
}

module.exports = {
    parseStatements,
    reconcile,
};
