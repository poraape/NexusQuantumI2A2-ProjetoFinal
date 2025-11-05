import flags from "../config/flags.json" assert { type: "json" };
import {
  mockChatCompletion,
  mockGenerateReportFromFiles,
  type MockAnalysisRequest,
  type MockReportResponse
} from "./mockGemini";
import { mockFetchCnpj } from "./mockCNPJ";

interface MockToolbox {
  geminiReport: typeof mockGenerateReportFromFiles;
  geminiChat: typeof mockChatCompletion;
  cnpjLookup: typeof mockFetchCnpj;
}

const noop = async (..._args: unknown[]): Promise<never> => {
  throw new Error("Mock desabilitado para este agente");
};

export function resolveMockTools(): MockToolbox {
  const { flags: flagSet } = flags;
  const enableMocks = flagSet.useMockAgents?.enabled ?? false;

  return {
    geminiReport: enableMocks ? mockGenerateReportFromFiles : (noop as MockToolbox["geminiReport"]),
    geminiChat: enableMocks ? mockChatCompletion : (noop as MockToolbox["geminiChat"]),
    cnpjLookup: enableMocks ? mockFetchCnpj : (noop as MockToolbox["cnpjLookup"])
  };
}

export type { MockAnalysisRequest, MockReportResponse };
