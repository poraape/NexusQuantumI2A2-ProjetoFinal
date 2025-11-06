// backend/services/artifactUtils.js

const DEFAULT_MAX_ARTIFACTS = parseInt(process.env.ANALYSIS_MAX_ARTIFACTS || '8', 10);
const DEFAULT_SNIPPET_LENGTH = parseInt(process.env.ANALYSIS_SNIPPET_LENGTH || '1200', 10);

function sanitize(text = '') {
    return text.replace(/\s+/g, ' ').trim();
}

function summarizeEntities(entities = {}) {
    const topCnpjs = (entities.cnpjs || []).slice(0, 5);
    const topMoney = (entities.monetaryValues || []).slice(0, 5);
    const topEmails = (entities.emails || []).slice(0, 5);
    return {
        cnpjs: topCnpjs,
        monetaryValues: topMoney,
        emails: topEmails,
    };
}

function buildArtifactSection(artifact, snippetLength) {
    const summary = artifact.summary || sanitize(artifact.text || '').slice(0, 250);
    const snippet = sanitize(artifact.text || '').slice(0, snippetLength);
    const entities = summarizeEntities(artifact.entities);
    const lines = [
        `### Documento: ${artifact.fileName || artifact.hash}`,
        summary ? `Resumo: ${summary}` : null,
        entities.cnpjs.length ? `CNPJs: ${entities.cnpjs.join(', ')}` : null,
        entities.monetaryValues.length ? `Valores: ${entities.monetaryValues.join(', ')}` : null,
        entities.emails.length ? `E-mails: ${entities.emails.join(', ')}` : null,
        `Trecho:\n${snippet}`,
    ].filter(Boolean);
    return lines.join('\n');
}

function buildAggregatedStats(artifacts = []) {
    const totals = {
        totalArtifacts: artifacts.length,
        totalSizeBytes: artifacts.reduce((acc, art) => acc + (art.size || 0), 0),
        totalChunks: artifacts.reduce((acc, art) => acc + (art.chunkCount || 0), 0),
        cnpjs: new Set(),
        monetaryValues: new Set(),
        parentDocuments: new Set(),
        fileTypes: {},
    };

    artifacts.forEach(artifact => {
        (artifact.entities?.cnpjs || []).forEach(cnpj => totals.cnpjs.add(cnpj));
        (artifact.entities?.monetaryValues || []).forEach(value => totals.monetaryValues.add(value));
        if (artifact.parentHash) {
            totals.parentDocuments.add(artifact.parentHash);
        } else if (artifact.hash) {
            totals.parentDocuments.add(artifact.hash);
        }
        const ext = (artifact.fileName || '').split('.').pop() || 'desconhecido';
        totals.fileTypes[ext] = (totals.fileTypes[ext] || 0) + 1;
    });

    return {
        totalArtifacts: totals.totalArtifacts,
        totalDocuments: totals.parentDocuments.size,
        totalSizeBytes: totals.totalSizeBytes,
        totalChunks: totals.totalChunks,
        distinctCnpjs: totals.cnpjs.size,
        distinctMonetaryValues: totals.monetaryValues.size,
        fileTypes: totals.fileTypes,
    };
}

function buildAnalysisContext(artifacts = [], options = {}) {
    const maxArtifacts = options.maxArtifacts || DEFAULT_MAX_ARTIFACTS;
    const snippetLength = options.snippetLength || DEFAULT_SNIPPET_LENGTH;

    const limitedArtifacts = artifacts.slice(0, maxArtifacts);
    const contextSections = limitedArtifacts.map(artifact => buildArtifactSection(artifact, snippetLength));
    const aggregatedStats = buildAggregatedStats(artifacts);

    return {
        context: contextSections.join('\n\n'),
        stats: aggregatedStats,
    };
}

module.exports = {
    buildAnalysisContext,
};
