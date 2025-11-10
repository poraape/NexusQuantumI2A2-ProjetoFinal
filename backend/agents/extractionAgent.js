// backend/agents/extractionAgent.js

const extractor = require('../services/extractor');
const { buildProcessingMetrics } = require('../services/artifactUtils');

function register({ eventBus, updateJobStatus, storageService }) {
    eventBus.on('task:start', async ({ jobId, taskName, payload }) => {
        if (taskName !== 'extraction') return;

        try {
            const { filesMeta } = payload;
            await updateJobStatus(jobId, 0, 'in-progress', `Descompactando e lendo ${filesMeta.length} arquivo(s)...`);

            const { artifacts, fileContentsForAnalysis } = await extractor.extractArtifactsForFiles(filesMeta, storageService);
            const processingMetrics = buildProcessingMetrics(artifacts, filesMeta);
            const nextPayload = {
                ...payload,
                artifacts,
                fileContentsForAnalysis,
            };

            await updateJobStatus(jobId, 0, 'completed');
            eventBus.emit('task:completed', {
                jobId,
                taskName,
                resultPayload: { fileContentsForAnalysis, artifacts, processingMetrics },
                payload: nextPayload,
            });
        } catch (error) {
            eventBus.emit('task:failed', { jobId, taskName, error: `Falha na extração: ${error.message}` });
        }
    });
}

module.exports = { register };
