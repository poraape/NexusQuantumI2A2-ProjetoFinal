const FIELD_DEFINITIONS = {
    valorTotalDasNfes: {
        label: 'Valor total das NF-e',
        keywords: [
            'valor total das nf-e',
            'valor total da nota fiscal',
            'valor total da nota',
            'total das nf-e',
            'total das notas fiscais',
            'total geral da nota fiscal',
        ],
    },
    valorTotalDosProdutos: {
        label: 'Valor total dos produtos',
        keywords: [
            'valor total dos produtos',
            'total dos produtos',
            'total das mercadorias',
            'valor dos itens',
            'valor dos produtos',
            'total dos itens',
        ],
    },
    valorTotalDeICMS: {
        label: 'ICMS total',
        keywords: [
            'valor total do icms',
            'icms total',
            'total do icms',
            'icms destacado',
        ],
    },
    valorTotalDePIS: {
        label: 'PIS total',
        keywords: [
            'valor total do pis',
            'pis total',
            'total do pis',
        ],
    },
    valorTotalDeCOFINS: {
        label: 'COFINS total',
        keywords: [
            'valor total do cofins',
            'cofins total',
            'total do cofins',
        ],
    },
    valorTotalDeISS: {
        label: 'ISS total',
        keywords: [
            'valor total do iss',
            'iss total',
            'total do iss',
        ],
    },
    valorTotalFrete: {
        label: 'Frete total',
        keywords: [
            'frete total',
            'valor do frete',
            'total do frete',
            'frete cobrado',
        ],
    },
    valorTotalDescontos: {
        label: 'Descontos totais',
        keywords: [
            'desconto total',
            'total de descontos',
            'valor do desconto',
            'descontos aplicados',
        ],
    },
};

const FIELD_LABELS = Object.fromEntries(
    Object.entries(FIELD_DEFINITIONS).map(([key, definition]) => [key, definition.label])
);

const METRIC_LABELS = {
    numeroDeDocumentosValidos: 'Documentos válidos',
    estimativaDeNVA: 'Estimativa de NVA',
    ...FIELD_LABELS,
};

const CURRENCY_VALUE_PATTERN = '([R$]?\\s*-?\\d{1,3}(?:[\\.\\s]?\\d{3})*(?:[\\.,]\\d{1,2})?)';
const KEYWORD_SEARCH_WINDOW = 80;

function escapeRegExp(value = '') {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseBrazilianNumber(value = '') {
    const hasParentheses = /\(.*\)/.test(value);
    const cleaned = value
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[()]/g, '');
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return null;
    if (hasParentheses) {
        return -Math.abs(parsed);
    }
    return value.trim().startsWith('-') && parsed > 0 ? -parsed : parsed;
}

function searchFieldValue(content = '', keywords = []) {
    if (!content || !keywords.length) return null;
    const text = content;
    for (const keyword of keywords) {
        const pattern = new RegExp(
            `${escapeRegExp(keyword)}[\\s\\S]{0,${KEYWORD_SEARCH_WINDOW}}?${CURRENCY_VALUE_PATTERN}`,
            'i'
        );
        const match = pattern.exec(text);
        if (match && match[1]) {
            const parsed = parseBrazilianNumber(match[1]);
            if (Number.isFinite(parsed)) {
                return parsed;
            }
        }
    }

    const currencyRegex = new RegExp(CURRENCY_VALUE_PATTERN, 'gi');
    let match;
    while ((match = currencyRegex.exec(text)) !== null) {
        const parsedValue = parseBrazilianNumber(match[1] || '');
        if (!Number.isFinite(parsedValue)) continue;
        const snippetStart = Math.max(0, match.index - KEYWORD_SEARCH_WINDOW);
        const snippetEnd = Math.min(text.length, match.index + match[0].length + KEYWORD_SEARCH_WINDOW);
        const snippet = text.slice(snippetStart, snippetEnd).toLowerCase();
        for (const keyword of keywords) {
            if (snippet.includes(keyword.toLowerCase())) {
                return parsedValue;
            }
        }
    }

    return null;
}

function extractLabeledFieldValues(content = '') {
    const values = {};
    Object.entries(FIELD_DEFINITIONS).forEach(([metric, definition]) => {
        const matchedValue = searchFieldValue(content, definition.keywords);
        values[metric] = Number.isFinite(matchedValue) ? matchedValue : 0;
    });
    return values;
}

function extractKeyMetricsFromFiles(files = []) {
    const combined = Array.isArray(files) ? files.map(f => f.content || '').join('\n') : '';
    const labeledValues = extractLabeledFieldValues(combined);

    return {
        numeroDeDocumentosValidos: Array.isArray(files) ? files.length : 0,
        estimativaDeNVA: 0,
        ...labeledValues,
    };
}

function formatKeyMetricsSummary(metrics = {}) {
    if (!metrics) return '';
    return Object.entries(metrics)
        .filter(([key, value]) => {
            if (key === 'numeroDeDocumentosValidos') return true;
            return Number.isFinite(value) && value !== 0;
        })
        .map(([key, value]) => {
            if (key === 'numeroDeDocumentosValidos') {
                const rounded = Math.round(value || 0);
                return `${METRIC_LABELS[key]}: ${rounded}`;
            }
            const formatted = value.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
            });
            return `${METRIC_LABELS[key] || key}: ${formatted}`;
        })
        .join('\n');
}

function mergeKeyMetricsWithComputed(original = {}, computed = {}) {
    const result = { ...original };
    Object.entries(computed).forEach(([key, value]) => {
        if (!Number.isFinite(value)) return;
        if (value > 0) {
            result[key] = value;
        } else if (result[key] === undefined) {
            result[key] = value;
        }
    });
    return result;
}

module.exports = {
    extractKeyMetricsFromFiles,
    formatKeyMetricsSummary,
    mergeKeyMetricsWithComputed,
    FIELD_DEFINITIONS,
};
