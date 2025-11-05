type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type MockResponse<T> = {
  latencyMs: number;
  payload: T;
  tokensUsed: number;
};

export interface MockAnalysisFile {
  name: string;
  hash: string;
}

export interface MockAnalysisRequest {
  files: MockAnalysisFile[];
}

export interface MockReportResponse {
  summary: string;
  sections: Array<{ id: string; title: string; summary: string }>;
  complianceFindings: unknown[];
  structuredData: {
    invoices: Array<{ id: string; amount: number; currency: string }>;
  };
}

const MOCK_SUMMARY = `Resumo executivo mockado.
- Receita: estável
- Custos: controlados
- Recomendações: executar auditoria periódica`;

export async function mockGenerateReportFromFiles(
  request: MockAnalysisRequest
): Promise<MockResponse<MockReportResponse>> {
  const latencyMs = 420 + request.files.length * 80;
  const sections = request.files.map((file, index) => ({
    id: `section-${index + 1}`,
    title: `Arquivo ${file.name}`,
    summary: `Resumo sintético para ${file.name}.`
  }));

  return {
    latencyMs,
    tokensUsed: 1024,
    payload: {
      summary: MOCK_SUMMARY,
      sections,
      complianceFindings: [],
      structuredData: {
        invoices: request.files.map((file, index) => ({
          id: `${file.hash}-${index}`,
          amount: (index + 1) * 100,
          currency: "BRL"
        }))
      }
    }
  };
}

export async function mockChatCompletion(
  history: ChatMessage[]
): Promise<MockResponse<{ message: ChatMessage }>> {
  const lastUserMessage = history.findLast((msg) => msg.role === "user");
  const answer = lastUserMessage?.content
    ? `Resposta mock para: ${lastUserMessage.content}`
    : "Resposta mock genérica.";

  return {
    latencyMs: 180,
    tokensUsed: 256,
    payload: {
      message: { role: "assistant", content: answer }
    }
  };
}
