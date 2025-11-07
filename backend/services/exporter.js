// backend/services/exporter.js
const { xml2json } = require('xml-js');
const accountingAutomation = require('./accountingAutomation');

function simplifyJson(obj) {
    if (Array.isArray(obj)) {
        return obj.map((value) => simplifyJson(value));
    }
    if (obj && typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (keys.length === 1 && keys[0] === '_text') {
            return obj._text;
        }
        return keys.reduce((acc, key) => {
            acc[key] = simplifyJson(obj[key]);
            return acc;
        }, {});
    }
    return obj;
}

function normalizeNumber(value) {
    if (value === undefined || value === null) return 0;
    const sanitized = String(value).replace(',', '.');
    const parsed = Number.parseFloat(sanitized);
    return Number.isFinite(parsed) ? parsed : 0;
}

function summarizeDoc(doc) {
    return {
        chave: doc?.chave,
        numero: doc?.ide?.nNF,
        emissor: doc?.emit?.xNome,
        destinatario: doc?.dest?.xNome,
        total: Number(doc?.total?.vNF || 0),
    };
}

async function parseNFeXML(xmlContent, fileName) {
    const trimmed = xmlContent.toString('utf8');
    const json = xml2json(trimmed, { compact: true, spaces: 0 });
    const parsed = JSON.parse(json);
    const nfeRoot = parsed.nfeProc || parsed.NfeProc || parsed.NFe || parsed.nFeProc || parsed.NFEProc;
    const infNFe =
        nfeRoot?.NFe?.infNFe ||
        nfeRoot?.infNFe ||
        nfeRoot?.nfe?.infNFe ||
        parsed.NFe?.infNFe ||
        parsed.nfe?.infNFe;
    if (!infNFe) {
        throw new Error(`Estrutura da NF-e não reconhecida no arquivo ${fileName}`);
    }

    const simplified = simplifyJson(infNFe);
    const det = Array.isArray(simplified.det) ? simplified.det : [simplified.det];

    let totalTaxes = 0;
    const itens = det
        .filter(Boolean)
        .map((item, index) => {
            const prod = item?.prod || {};
            const imposto = item?.imposto || {};
            const icmsGroup = imposto?.ICMS || {};
            const icmsValue =
                normalizeNumber(icmsGroup.ICMS00?.vICMS) ||
                normalizeNumber(icmsGroup.ICMS10?.vICMS) ||
                normalizeNumber(icmsGroup.ICMS20?.vICMS) ||
                normalizeNumber(icmsGroup.ICMS40?.vICMS) ||
                normalizeNumber(icmsGroup.ICMS51?.vICMS) ||
                normalizeNumber(icmsGroup.ICMS60?.vICMS);
            const pisValue = normalizeNumber(imposto?.PIS?.PISAliq?.vPIS || imposto?.PIS?.PISOutr?.vPIS);
            const cofinsValue = normalizeNumber(
                imposto?.COFINS?.COFINSAliq?.vCOFINS || imposto?.COFINS?.COFINSOutr?.vCOFINS
            );
            totalTaxes += icmsValue + pisValue + cofinsValue;

            return {
                nItem: item?._attributes?.nItem || index + 1,
                cProd: prod.cProd,
                xProd: prod.xProd,
                ncm: prod.NCM,
                cfop: prod.CFOP,
                uCom: prod.uCom,
                qCom: normalizeNumber(prod.qCom),
                vUnCom: normalizeNumber(prod.vUnCom),
                vProd: normalizeNumber(prod.vProd),
                imposto,
            };
        });

    const chave = simplified?._attributes?.Id
        ? simplified._attributes.Id.replace(/^NFe/i, '')
        : simplified?.ide?.nNF || fileName;

    return {
        fileName,
        chave,
        ide: simplified.ide,
        emit: simplified.emit,
        dest: simplified.dest,
        itens,
        total: simplified.total?.ICMSTot || {},
        valorImpostos: Number(totalTaxes.toFixed(2)),
        validationIssues: validateDocument(simplified, itens),
        semaforoFiscal: 'ok',
    };
}

function validateDocument(doc, itens) {
    const issues = [];
    const totalInformado = normalizeNumber(doc?.total?.ICMSTot?.vNF);
    const somaItens = itens.reduce((acc, item) => acc + normalizeNumber(item.vProd), 0);
    if (totalInformado && Math.abs(totalInformado - somaItens) > 0.05) {
        issues.push(
            `Diferença entre o total informado (${totalInformado.toFixed(2)}) e a soma dos itens (${somaItens.toFixed(2)})`
        );
    }
    return issues;
}

async function extractDocumentsFromStorage(fileMetas = [], storageService) {
    const documentos = [];
    const log = [];

    for (const meta of fileMetas) {
        if (!meta?.hash || !meta?.name) continue;
        if (!meta.name.toLowerCase().endsWith('.xml')) {
            log.push(`Ignorando '${meta.name}': apenas XML é suportado na exportação fiscal.`);
            continue;
        }

        try {
            const buffer = await storageService.readFileBuffer(meta.hash);
            const documento = await parseNFeXML(buffer, meta.name);
            documentos.push(documento);
        } catch (error) {
            log.push(`Falha ao processar '${meta.name}': ${error.message}`);
        }
    }

    return { documentos, log };
}

function gerarSpedFiscal(documentos = []) {
    const inicio = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let sped = `|0000|017|0|${inicio}|${inicio}|EMPRESA|00.000.000/0000-00|SP|123456789|3550308||0|\n|0001|0|\n`;

    documentos.forEach((doc) => {
        sped += `|C100|0|1|${doc.dest?.CNPJ || doc.dest?.CPF}|55|00|${doc.ide?.serie}|${doc.ide?.nNF}|${doc.chave}|${
            doc.ide?.dhEmi
        }|...\n`;
        doc.itens.forEach((item) => {
            sped += `|C170|${item.nItem}|${item.cProd}|${item.xProd}|${item.qCom}|${item.uCom}|${item.vProd}|...\n`;
        });
    });
    sped += `|9999|${sped.split('\n').filter(Boolean).length}|\n`;
    return sped;
}

function gerarEfdContribuicoes(documentos = []) {
    const inicio = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    let efd = `|0000|007|0||${inicio}|${inicio}|EMPRESA|00.000.000/0000-00|SP|123456789|3550308||0|\n|0001|0|\n`;

    documentos.forEach((doc) => {
        efd += `|C100|0|1|${doc.dest?.CNPJ || doc.dest?.CPF}|55|00|${doc.ide?.serie}|${doc.ide?.nNF}|${doc.chave}|${
            doc.ide?.dhEmi
        }|...\n`;
        doc.itens.forEach((item) => {
            efd += `|C175|${item.cfop}|${item.vProd}|...\n`;
        });
    });

    efd += `|9999|${efd.split('\n').filter(Boolean).length}|\n`;
    return efd;
}

function gerarCsvERP(documentos = []) {
    const rows = [
        [
            'chave_nfe',
            'data_emissao',
            'cnpj_emitente',
            'nome_emitente',
            'cnpj_destinatario',
            'nome_destinatario',
            'item_n',
            'cod_prod',
            'desc_prod',
            'ncm',
            'cfop',
            'qtd',
            'un',
            'v_unit',
            'v_total_item',
        ],
    ];
    documentos.forEach((doc) => {
        doc.itens.forEach((item) => {
            rows.push([
                doc.chave,
                doc.ide?.dhEmi,
                doc.emit?.CNPJ,
                doc.emit?.xNome,
                doc.dest?.CNPJ || doc.dest?.CPF,
                doc.dest?.xNome,
                String(item.nItem),
                item.cProd,
                item.xProd,
                item.ncm,
                item.cfop,
                String(item.qCom),
                item.uCom,
                String(item.vUnCom),
                String(item.vProd),
            ]);
        });
    });
    return rows
        .map((row) => row.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
}

function gerarCsvLancamentos(documentos = []) {
    const entries = accountingAutomation.suggestAccountingEntries(documentos);
    return accountingAutomation.entriesToCsv(entries);
}

module.exports = {
    extractDocumentsFromStorage,
    gerarSpedFiscal,
    gerarEfdContribuicoes,
    gerarCsvERP,
    gerarCsvLancamentos,
    summarizeDoc,
};
