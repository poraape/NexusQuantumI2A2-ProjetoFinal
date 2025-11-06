process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-key';

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
    return {
        className: 'TestClass',
        client: {
            graphql: {
                get: jest.fn(() => builder),
            },
        },
        __graphBuilder: builder,
    };
});

jest.mock('../services/geminiClient', () => ({
    embeddingModel: {
        embedContent: jest.fn(),
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
const server = require('../server');

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
    let graphQLGetSpy;

    afterAll(async () => {
        server.close();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        const graphBuilder = weaviate.__graphBuilder;
        graphBuilder.withClassName.mockReturnThis();
        graphBuilder.withFields.mockReturnThis();
        graphBuilder.withWhere.mockReturnThis();
        graphBuilder.withNearVector.mockReturnThis();
        graphBuilder.withLimit.mockReturnThis();
        graphBuilder.do.mockReset();
        weaviate.client.graphql.get.mockImplementation(() => graphBuilder);
        geminiClient.embeddingModel.embedContent.mockReset();
        geminiClient.model.startChat.mockReset();
        geminiClient.availableTools.tax_simulation.mockReset();
        graphQLGetSpy = jest.spyOn(weaviate.client.graphql, 'get');
    });

    afterEach(() => {
        if (graphQLGetSpy) {
            graphQLGetSpy.mockRestore();
        }
    });

    it('should return 400 if question is missing', async () => {
        const response = await request(server)
            .post(`/api/jobs/${jobId}/chat`)
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('A pergunta é obrigatória.');
    });

    it('should return a direct answer if no context is found', async () => {
        jest.spyOn(geminiClient.embeddingModel, 'embedContent').mockResolvedValue({ embedding: { values: [0.1, 0.2] } });

        let builder;
        graphQLGetSpy.mockImplementation(() => {
            builder = createGraphQLBuilder();
            builder.do.mockResolvedValue({ data: { Get: { [weaviate.className]: [] } } });
            return builder;
        });

        const sendMessageMock = jest.fn().mockResolvedValue({
            response: {
                text: () => "Desculpe, não encontrei informações nos documentos fornecidos para responder a essa pergunta.",
                functionCalls: () => [],
            },
        });
        jest.spyOn(geminiClient.model, 'startChat').mockReturnValue({ sendMessage: sendMessageMock });

        const response = await request(server)
            .post(`/api/jobs/${jobId}/chat`)
            .send({ question: 'Qual o valor total?' });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe("Desculpe, não encontrei informações nos documentos fornecidos para responder a essa pergunta.");
    });

    it('should get a RAG-based answer from the AI', async () => {
        const question = 'Qual o valor total?';
        const aiAnswer = 'O valor total é R$ 1.234,56.';

        // Mock da geração de embedding
        jest.spyOn(geminiClient.embeddingModel, 'embedContent').mockResolvedValue({ embedding: { values: [0.1, 0.2] } });

        // Mock da busca no Weaviate
        let builder;
        graphQLGetSpy.mockImplementation(() => {
            builder = createGraphQLBuilder();
            builder.do.mockResolvedValue({
                data: { Get: { [weaviate.className]: [{ content: 'Nota fiscal com valor de R$ 1.234,56', fileName: 'nf-1.xml' }] } }
            });
            return builder;
        });

        // Mock da resposta da IA (sem uso de ferramenta)
        const sendMessageMock = jest.fn().mockResolvedValue({
            response: {
                text: () => aiAnswer,
                functionCalls: () => [],
            },
        });
        const startChatSpy = jest.spyOn(geminiClient.model, 'startChat').mockReturnValue({ sendMessage: sendMessageMock });

        const response = await request(server)
            .post(`/api/jobs/${jobId}/chat`)
            .send({ question });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe(aiAnswer);
        expect(startChatSpy).toHaveBeenCalledTimes(1);
        expect(sendMessageMock).toHaveBeenCalledWith(expect.stringContaining(question));
        expect(sendMessageMock).toHaveBeenCalledWith(expect.stringContaining('Nota fiscal com valor de R$ 1.234,56'));
    });

    it('should handle a tool call from the AI during chat', async () => {
        const question = 'Simule os impostos para 10000.';
        const finalAiAnswer = 'A simulação para R$ 10.000,00 resultou em um total de R$ 1.500,00 em impostos.';

        jest.spyOn(geminiClient.embeddingModel, 'embedContent').mockResolvedValue({ embedding: { values: [0.3, 0.4] } });

        let builder;
        graphQLGetSpy.mockImplementation(() => {
            builder = createGraphQLBuilder();
            builder.do.mockResolvedValue({
                data: { Get: { [weaviate.className]: [{ content: 'Documento base para simulação', fileName: 'doc.pdf' }] } }
            });
            return builder;
        });

        // Mock da IA: primeira resposta solicita ferramenta, segunda resposta usa o resultado
        const chatMock = {
            sendMessage: jest.fn()
                .mockResolvedValueOnce({ response: { functionCalls: () => [{ name: 'tax_simulation', args: { baseValue: 10000 } }] } })
                .mockResolvedValueOnce({ response: { text: () => finalAiAnswer, functionCalls: () => [] } })
        };
        jest.spyOn(geminiClient.model, 'startChat').mockReturnValue(chatMock);
        const taxSpy = jest.spyOn(geminiClient.availableTools, 'tax_simulation').mockResolvedValue({ totalTax: 1500 });

        const response = await request(server)
            .post(`/api/jobs/${jobId}/chat`)
            .send({ question });

        expect(response.status).toBe(200);
        expect(response.body.answer).toBe(finalAiAnswer);
        expect(taxSpy).toHaveBeenCalledWith({ baseValue: 10000 });
        expect(chatMock.sendMessage).toHaveBeenCalledTimes(2);
    });
});
