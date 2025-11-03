// services/accountingAutomation.ts
import { DocumentoFiscalDetalhado } from "../types";

export interface AccountingEntry {
    data: string | undefined;
    descricao: string;
    cfop: string | undefined;
    conta_debito: string;
    conta_credito: string;
    valor: number;
    historico: string;
}

/**
 * Infere a conta contábil e o tipo de lançamento (débito/crédito) com base no CFOP.
 * Esta é uma lógica simplificada para fins de demonstração.
 * @param cfop O Código Fiscal de Operações e Prestações.
 * @returns Um objeto com as contas de débito e crédito.
 */
function inferirContas(cfop: string | undefined, tipo: 'emit' | 'dest'): { contaDebito: string, contaCredito: string } {
    if (!cfop) return { contaDebito: "Ajuste Manual", contaCredito: "Ajuste Manual" };

    const cfopPrefix = cfop[0];

    if (['5', '6', '7'].includes(cfopPrefix)) { // Saída (Venda/Serviço)
        return {
            contaDebito: tipo === 'emit' ? "Clientes a Receber" : "Duplicatas a Pagar",
            contaCredito: "Receita de Vendas/Serviços"
        };
    }
    if (['1', '2', '3'].includes(cfopPrefix)) { // Entrada (Compra)
        return {
            contaDebito: "Estoque de Mercadorias",
            contaCredito: tipo === 'emit' ? "Clientes a Receber" : "Fornecedores a Pagar"
        };
    }

    return { contaDebito: "Despesas/Custos Diversos", contaCredito: "Caixa/Banco" };
}


/**
 * Gera sugestões de lançamentos contábeis a partir de documentos fiscais detalhados.
 * @param documentos Um array de objetos DocumentoFiscalDetalhado.
 * @returns Um array de objetos AccountingEntry.
 */
export function suggestAccountingEntries(documentos: DocumentoFiscalDetalhado[]): AccountingEntry[] {
    const entries: AccountingEntry[] = [];

    documentos.forEach(doc => {
        // Lançamento principal da nota
        const cfopPrincipal = doc.itens[0]?.cfop;
        const valorTotal = parseFloat(doc.total?.vNF || '0');
        const { contaDebito, contaCredito } = inferirContas(cfopPrincipal, 'emit');

        entries.push({
            data: doc.ide?.dhEmi,
            descricao: `NF-e ${doc.ide?.nNF} | ${doc.emit?.xNome}`,
            cfop: cfopPrincipal,
            conta_debito: contaDebito,
            conta_credito: contaCredito,
            valor: valorTotal,
            historico: `Referente à nota fiscal chave ${doc.chave}`
        });

        // Lançamentos de impostos (exemplo simplificado com ICMS)
        const valorICMS = parseFloat(doc.total?.vICMS || '0');
        if (valorICMS > 0) {
            entries.push({
                data: doc.ide?.dhEmi,
                descricao: `Imposto ICMS NF-e ${doc.ide?.nNF}`,
                cfop: cfopPrincipal,
                conta_debito: "ICMS a Recolher",
                conta_credito: "ICMS sobre Vendas",
                valor: valorICMS,
                historico: `ICMS da nota fiscal chave ${doc.chave}`
            });
        }
    });

    return entries;
}

/**
 * Converte um array de objetos em uma string CSV.
 * @param data O array de objetos a ser convertido.
 * @returns Uma string no formato CSV.
 */
export function exportToCSV(data: any[]): string {
    if (data.length === 0) return "";
    
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => {
        return Object.values(row).map(value => {
            const strValue = String(value || '').replace(/"/g, '""');
            return `"${strValue}"`;
        }).join(",");
    }).join("\n");

    return `${headers}\n${rows}`;
}