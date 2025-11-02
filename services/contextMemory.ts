import { ExecutiveSummary, SimulationResult, SimulationParams, ClassificationResult, ForecastResult } from '../types.ts';

const CONTEXT_PREFIX = 'NEXUS_CTX_';
const CACHE_EXPIRATION_MS = 48 * 60 * 60 * 1000; // 48 hours

const CONTEXT_KEYS = {
    LAST_REPORT_SUMMARY: 'LAST_REPORT_SUMMARY',
    SIMULATION_CACHE: 'SIMULATION_CACHE',
    DOCUMENT_INDEX: 'DOCUMENT_INDEX',
    QA_CACHE: 'QA_CACHE',
    CLASSIFICATIONS: 'CLASSIFICATIONS',
    FORECAST: 'FORECAST',
    CACHE_METADATA: 'CACHE_METADATA'
};

interface CacheMetadata {
    [key: string]: { timestamp: number };
}

// --- Generic Storage Functions ---

const getMetadata = (): CacheMetadata => {
    try {
        const meta = localStorage.getItem(`${CONTEXT_PREFIX}${CONTEXT_KEYS.CACHE_METADATA}`);
        return meta ? JSON.parse(meta) : {};
    } catch {
        return {};
    }
}

const setMetadata = (meta: CacheMetadata): void => {
    localStorage.setItem(`${CONTEXT_PREFIX}${CONTEXT_KEYS.CACHE_METADATA}`, JSON.stringify(meta));
}

const storeContext = (key: string, value: any): void => {
    try {
        const serializedValue = JSON.stringify(value);
        localStorage.setItem(`${CONTEXT_PREFIX}${key}`, serializedValue);
        // Update timestamp in metadata
        const meta = getMetadata();
        meta[key] = { timestamp: Date.now() };
        setMetadata(meta);
    } catch (error) {
        console.error(`[ContextMemory] Failed to store context for key "${key}":`, error);
    }
};

const getContext = <T>(key: string): T | null => {
    try {
        const serializedValue = localStorage.getItem(`${CONTEXT_PREFIX}${key}`);
        if (serializedValue === null) return null;
        return JSON.parse(serializedValue) as T;
    } catch (error) {
        console.error(`[ContextMemory] Failed to retrieve or parse context for key "${key}":`, error);
        localStorage.removeItem(`${CONTEXT_PREFIX}${key}`);
        return null;
    }
};

export const clearContext = (): void => {
    Object.keys(localStorage).forEach(key => {
        if (key.startsWith(CONTEXT_PREFIX)) localStorage.removeItem(key);
    });
    console.log('[ContextMemory] All application context has been cleared.');
};

export const purgeOldCache = (): void => {
    const meta = getMetadata();
    const now = Date.now();
    let purgedCount = 0;
    
    Object.entries(meta).forEach(([key, { timestamp }]) => {
        if (now - timestamp > CACHE_EXPIRATION_MS) {
            localStorage.removeItem(`${CONTEXT_PREFIX}${key}`);
            delete meta[key];
            purgedCount++;
        }
    });

    if (purgedCount > 0) {
        setMetadata(meta);
        console.log(`[ContextMemory] Purged ${purgedCount} expired cache entries.`);
    }
};

// --- Report & Simulation Cache ---

export const storeLastReportSummary = (summary: ExecutiveSummary) => storeContext(CONTEXT_KEYS.LAST_REPORT_SUMMARY, summary);
export const getLastReportSummary = (): ExecutiveSummary | null => getContext<ExecutiveSummary>(CONTEXT_KEYS.LAST_REPORT_SUMMARY);

const getSimulationCache = (): Record<string, SimulationResult> => getContext<Record<string, SimulationResult>>(CONTEXT_KEYS.SIMULATION_CACHE) || {};
export const storeSimulationResult = (params: SimulationParams, result: SimulationResult) => {
    const cache = getSimulationCache();
    cache[JSON.stringify(params)] = result;
    storeContext(CONTEXT_KEYS.SIMULATION_CACHE, cache);
};
export const getCachedSimulation = (params: SimulationParams): SimulationResult | null => {
    const cache = getSimulationCache();
    return cache[JSON.stringify(params)] || null;
};

// --- RAG (Retrieval-Augmented Generation) System for Chat ---

interface DocumentChunk {
    fileName: string;
    content: string;
    keywords: string[];
}
type DocumentIndex = DocumentChunk[];

const extractKeywords = (text: string): string[] => {
    if (!text || typeof text !== 'string') return [];
    const words = text.toLowerCase().match(/\b[a-zA-Z\dÀ-ÿ]{4,}\b/g);
    return words ? [...new Set(words)] : [];
};

const segmentContent = (content: string, fileName: string): DocumentChunk[] => {
    const segments = content.split(/\n\s*\n/);
    return segments.map(seg => ({
        fileName,
        content: seg,
        keywords: extractKeywords(seg),
    })).filter(chunk => chunk.content.trim().length > 20);
};

export const createAndStoreIndex = (files: {fileName: string, content: string}[]) => {
    console.debug('[ContextMemory.RAG] Iniciando indexação de documentos...');
    const fullIndex: DocumentIndex = files.flatMap(file => segmentContent(file.content, file.fileName));
    storeContext(CONTEXT_KEYS.DOCUMENT_INDEX, fullIndex);
    console.debug(`[ContextMemory.RAG] Indexação concluída. ${fullIndex.length} segmentos criados.`);
};

export const searchIndex = (query: string, topK = 5): DocumentChunk[] => {
    const index = getContext<DocumentIndex>(CONTEXT_KEYS.DOCUMENT_INDEX);
    if (!Array.isArray(index) || index.length === 0) {
        console.warn("[ContextMemory.RAG] Nenhum contexto encontrado.");
        return [];
    }
    
    const queryKeywords = new Set(extractKeywords(query));
    if (queryKeywords.size === 0) return [];
    
    const scoredChunks = index.map(chunk => {
        const chunkKeywords = Array.isArray(chunk.keywords) ? chunk.keywords : [];
        const intersection = new Set(chunkKeywords.filter(k => queryKeywords.has(k)));
        return { chunk, score: intersection.size };
    });

    scoredChunks.sort((a, b) => b.score - a.score);
    const relevantChunks = scoredChunks.slice(0, topK).filter(c => c.score > 0);
    
    console.debug(`[ContextMemory.RAG] Busca por "${query}" encontrou ${relevantChunks.length} segmentos relevantes.`);
    return relevantChunks.map(c => c.chunk);
};

const getQACache = (): Record<string, string> => getContext<Record<string, string>>(CONTEXT_KEYS.QA_CACHE) || {};

export const storeAnswer = (question: string, answer: string) => {
    const cache = getQACache();
    const key = question.trim().toLowerCase();
    cache[key] = answer;
    storeContext(CONTEXT_KEYS.QA_CACHE, cache);
};

export const getAnswer = (question: string): string | null => {
    const cache = getQACache();
    const key = question.trim().toLowerCase();
    return cache[key] || null;
};

// --- Classification & Forecast Cache ---
export const storeClassifications = (classifications: ClassificationResult[]) => storeContext(CONTEXT_KEYS.CLASSIFICATIONS, classifications);
export const getClassifications = (): ClassificationResult[] | null => getContext<ClassificationResult[]>(CONTEXT_KEYS.CLASSIFICATIONS);

export const storeForecast = (forecast: ForecastResult) => storeContext(CONTEXT_KEYS.FORECAST, forecast);
export const getForecast = (): ForecastResult | null => getContext<ForecastResult>(CONTEXT_KEYS.FORECAST);