process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';
process.env.NODE_ENV = 'test';

const mockRedisClient = {
    get: jest.fn(),
    set: jest.fn(),
    expire: jest.fn(),
    ping: jest.fn(),
};

const mockEventBus = {
    emit: jest.fn(),
    on: jest.fn(),
};

jest.mock('../services/redisClient', () => mockRedisClient);
jest.mock('../services/eventBus', () => mockEventBus);

jest.mock('../services/weaviateClient', () => {
    const builder = {
        withClassName: jest.fn().mockReturnThis(),
        withFields: jest.fn().mockReturnThis(),
        withWhere: jest.fn().mockReturnThis(),
        withNearVector: jest.fn().mockReturnThis(),
        withLimit: jest.fn().mockReturnThis(),
        do: jest.fn(),
    };
    const batcher = {
        withObjects: jest.fn().mockReturnThis(),
        do: jest.fn(),
    };
    const batchFactory = jest.fn(() => batcher);
    return {
        className: 'TestClass',
        client: {
            graphql: {
                get: jest.fn(() => builder),
            },
            batch: {
                objectsBatcher: batchFactory,
            },
        },
        __graphBuilder: builder,
        __batcher: batcher,
    };
});

jest.mock('../services/geminiClient', () => ({
    embeddingModel: {
        embedContent: jest.fn(),
        batchEmbedContents: jest.fn().mockResolvedValue({ embeddings: [] }),
    },
    model: {
        startChat: jest.fn(),
    },
    availableTools: {
        tax_simulation: jest.fn(),
    },
}));

const request = require('supertest');
const weaviate = require('../services/weaviateClient');
const geminiClient = require('../services/geminiClient');
const { app } = require('../server');

function createGraphQLBuilder() {
    return {
        withClassName: jest.fn().mockReturnThis(),
        withFields: jest.fn().mockReturnThis(),
        withWhere: jest.fn().mockReturnThis(),
        withNearVector: jest.fn().mockReturnThis(),
        withLimit: jest.fn().mockReturnThis(),
        do: jest.fn(),
    };
}

describe('POST /api/jobs/:jobId/chat', () => {
    const jobId = 'test-job-123';
    const baseJob = {
        status: 'completed',
        uploadedFiles: [{ name: 'nf-1.xml', size: 2048 }],
        result: {
            executiveSummary: {
                title: 'Resumo Fiscal',
                description: 'Descrição resumida.',
                keyMetrics: { numeroDeDocumentosValidos: 1 },
                actionableInsights: [{ text: 'Verificar créditos de ICMS.' }],
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockRedisClient.get.mockImplementation((key) => {
            if (String(key) === `job:${jobId}`) {
                return Promise.resolve(JSON.stringify(baseJob));
            }
            return Promise.resolve(null);
        });
        mockRedisClient.set.mockResolvedValue('OK');
        geminiClient.embeddingModel.embedContent.mockReset();
        geminiClient.embeddingModel.batchEmbedContents.mockReset().mockResolvedValue({ embeddings: [] });
        geminiClient.model.startChat.mockReset();
        geminiClient.availableTools.tax_simulation.mockReset();
        const builder = createGraphQLBuilder();
        builder.do.mockResolvedValue({ data: { Get: { [weaviate.className]: [] } } });
        weaviate.client.graphql.get.mockReturnValue(builder);
    });

    it('should return 400 if question is missing', async () => {
        const response = await request(app)
            .post(`/api/jobs/${jobId}/chat`)
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('É necessário informar uma pergunta ou anexar arquivos.');
    });

    it('should return a direct answer if no context is found', async () => {
        geminiClient.embeddingModel.embedContent.mockResolvedValue({ embedding: { values: [0.1, 0.2] } });

        const sendMessageMock = jest.fn().mockResolvedValue({
            response: {
                text: () => 'Sem contexto disponível.',
                functionCalls: () => [],
            },
        });
        geminiClient.model.startChat.mockReturnValue({ sendMessage: sendMessageMock });

        const response = await request(app)
            .post(`/api/jobs/${jobId}/chat`)
            .send({ question: 'Qual o valor total?' });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe('Sem contexto disponível.');
        expect(mockRedisClient.set).toHaveBeenCalledWith(
            expect.stringContaining(`job:${jobId}:chat:`),
            'Sem contexto disponível.',
            expect.objectContaining({ EX: expect.any(Number) })
        );
    });

    it('should get a RAG-based answer from the AI', async () => {
        const question = 'Qual o valor total?';
        const aiAnswer = 'O valor total é R$ 1.234,56.';

        geminiClient.embeddingModel.embedContent.mockResolvedValue({ embedding: { values: [0.1, 0.2] } });
        const builder = createGraphQLBuilder();
        builder.do.mockResolvedValue({
            data: { Get: { [weaviate.className]: [{ content: 'Nota fiscal com valor de R$ 1.234,56', fileName: 'nf-1.xml' }] } }
        });
        weaviate.client.graphql.get.mockReturnValue(builder);

        const sendMessageMock = jest.fn().mockResolvedValue({
            response: {
                text: () => aiAnswer,
                functionCalls: () => [],
            },
        });
        geminiClient.model.startChat.mockReturnValue({ sendMessage: sendMessageMock });

        const response = await request(app)
            .post(`/api/jobs/${jobId}/chat`)
            .send({ question });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe(aiAnswer);
        const promptPayload = sendMessageMock.mock.calls[0][0];
        expect(promptPayload).toContain('Nota fiscal com valor de R$ 1.234,56');
        expect(promptPayload).toContain(question);
    });

    it('should handle a tool call from the AI during chat', async () => {
        const question = 'Simule os impostos para 10000.';
        const finalAiAnswer = 'A simulação para R$ 10.000,00 resultou em um total de R$ 1.500,00 em impostos.';

        geminiClient.embeddingModel.embedContent.mockResolvedValue({ embedding: { values: [0.3, 0.4] } });
        const builder = createGraphQLBuilder();
        builder.do.mockResolvedValue({
            data: { Get: { [weaviate.className]: [{ content: 'Documento base para simulação', fileName: 'doc.pdf' }] } }
        });
        weaviate.client.graphql.get.mockReturnValue(builder);

        const chatMock = {
            sendMessage: jest.fn()
                .mockResolvedValueOnce({ response: { functionCalls: () => [{ name: 'tax_simulation', args: { baseValue: 10000 } }] } })
                .mockResolvedValueOnce({ response: { text: () => finalAiAnswer, functionCalls: () => [] } }),
        };
        geminiClient.model.startChat.mockReturnValue(chatMock);
        geminiClient.availableTools.tax_simulation.mockResolvedValue({ totalTax: 1500 });

        const response = await request(app)
            .post(`/api/jobs/${jobId}/chat`)
            .send({ question });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe(finalAiAnswer);
        expect(geminiClient.availableTools.tax_simulation).toHaveBeenCalledWith({ baseValue: 10000 });
        expect(chatMock.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should process attachments on the backend and skip caching', async () => {
        geminiClient.embeddingModel.embedContent.mockResolvedValue({ embedding: { values: [0.5, 0.6] } });
        const sendMessageMock = jest.fn().mockResolvedValue({
            response: {
                text: () => 'Anexos analisados com sucesso.',
                functionCalls: () => [],
            },
        });
        geminiClient.model.startChat.mockReturnValue({ sendMessage: sendMessageMock });

        const response = await request(app)
            .post(`/api/jobs/${jobId}/chat`)
            .attach('attachments', Buffer.from('conteúdo fiscal relevante'), 'nf.txt');

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe('Anexos analisados com sucesso.');
        expect(mockRedisClient.set).not.toHaveBeenCalled();
    });
});
