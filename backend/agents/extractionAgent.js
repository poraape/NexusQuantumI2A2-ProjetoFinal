// backend/agents/extractionAgent.js

const extractor = require('../services/extractor');

function register({ eventBus, updateJobStatus, storageService }) {
    eventBus.on('task:start', async ({ jobId, taskName, payload }) => {
        if (taskName !== 'extraction') return;

        try {
            const { filesMeta } = payload;
            await updateJobStatus(jobId, 0, 'in-progress', `Descompactando e lendo ${filesMeta.length} arquivo(s)...`);

            const fileContentsForAnalysis = [];
            const artifacts = [];

            for (const file of filesMeta) {
                const extractedArtifacts = await extractor.extractArtifactsForFileMeta(file, storageService);
                extractedArtifacts.forEach(artifact => {
                    artifacts.push(artifact);
                    fileContentsForAnalysis.push({ fileName: artifact.fileName, content: artifact.text });
                });
            }

            const nextPayload = {
                ...payload,
                artifacts,
                fileContentsForAnalysis,
            };

            await updateJobStatus(jobId, 0, 'completed');
            eventBus.emit('task:completed', { jobId, taskName, resultPayload: { fileContentsForAnalysis, artifacts }, payload: nextPayload });
        } catch (error) {
            eventBus.emit('task:failed', { jobId, taskName, error: `Falha na extração: ${error.message}` });
        }
    });
}

module.exports = { register };
