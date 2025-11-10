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

function buildProcessingMetrics(artifacts = [], fileMetas = []) {
    const fileMetaMap = new Map((fileMetas || []).map(meta => [meta.hash, meta]));
    const docMetrics = new Map();
    const entitySets = {
        cnpjs: new Set(),
        monetaryValues: new Set(),
        emails: new Set(),
    };
    let totalChunks = 0;
    let totalCharacters = 0;
    const fileTypeMap = new Map();

    function ensureDocEntry(hash, fallbackName, fallbackMime, detectionCategory) {
        if (docMetrics.has(hash)) return docMetrics.get(hash);
        const meta = fileMetaMap.get(hash);
        const entry = {
            fileName: meta?.originalName || fallbackName || `doc-${hash}`,
            hash,
            mimeType: meta?.mimeType || fallbackMime || 'desconhecido',
            sizeBytes: meta?.size || 0,
            artifactCount: 0,
            chunkCount: 0,
            textLength: 0,
            detectionCategory: detectionCategory || 'desconhecido',
        };
        docMetrics.set(hash, entry);
        return entry;
    }

    (artifacts || []).forEach(artifact => {
        const parentHash = artifact.parentHash || artifact.hash || artifact.fileName || 'artifact-unknown';
        const parentName = artifact.parentName || artifact.fileName || 'documento';
        const detectionCategory = artifact.detection?.category || 'desconhecido';
        const docEntry = ensureDocEntry(parentHash, parentName, artifact.mimeType, detectionCategory);
        docEntry.artifactCount += 1;
        docEntry.chunkCount += artifact.chunkCount || 0;
        const textLength = (artifact.text || '').length;
        docEntry.textLength += textLength;
        docEntry.sizeBytes = Math.max(docEntry.sizeBytes || 0, artifact.size || docEntry.sizeBytes || 0);
        docEntry.mimeType = docEntry.mimeType || artifact.mimeType || 'desconhecido';
        docEntry.detectionCategory = detectionCategory;

        totalChunks += artifact.chunkCount || 0;
        totalCharacters += textLength;

        const fileTypeLabel = detectionCategory;
        const existingType = fileTypeMap.get(fileTypeLabel) || { category: fileTypeLabel, count: 0, bytes: 0 };
        existingType.count += 1;
        existingType.bytes += artifact.size || 0;
        fileTypeMap.set(fileTypeLabel, existingType);

        (artifact.entities?.cnpjs || []).forEach(cnpj => entitySets.cnpjs.add(cnpj));
        (artifact.entities?.monetaryValues || []).forEach(value => entitySets.monetaryValues.add(value));
        (artifact.entities?.emails || []).forEach(email => entitySets.emails.add(email));
    });

    (fileMetas || []).forEach(meta => {
        if (!meta || !meta.hash) return;
        const entry = ensureDocEntry(meta.hash, meta.originalName || meta.name, meta.mimeType || 'desconhecido', 'meta');
        entry.sizeBytes = Math.max(entry.sizeBytes, meta.size || 0);
    });

    const fileTypeBreakdown = Array.from(fileTypeMap.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    const documentSummaries = Array.from(docMetrics.values())
        .sort((a, b) => b.artifactCount - a.artifactCount || b.textLength - a.textLength)
        .slice(0, 5);

    const totalStoredBytes = (fileMetas || []).reduce((sum, meta) => sum + (meta?.size || 0), 0);

    return {
        captureTimestamp: new Date().toISOString(),
        totalUploadedFiles: (fileMetas || []).length,
        totalStoredBytes,
        totalArtifacts: (artifacts || []).length,
        totalChunks,
        totalCharacters,
        distinctDocuments: docMetrics.size,
        entityCoverage: {
            cnpjs: entitySets.cnpjs.size,
            monetaryValues: entitySets.monetaryValues.size,
            emails: entitySets.emails.size,
        },
        fileTypeBreakdown,
        documents: documentSummaries,
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
    buildProcessingMetrics,
};
