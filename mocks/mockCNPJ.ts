export interface MockCnpjResponse {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string;
  situacaoCadastral: "ATIVA" | "SUSPENSA" | "BAIXADA";
  atualizadoEm: string;
}

const REGISTRY: Record<string, MockCnpjResponse> = {
  "00000000000191": {
    cnpj: "00.000.000/0001-91",
    razaoSocial: "Empresa Mock LTDA",
    nomeFantasia: "Mock Fiscal",
    situacaoCadastral: "ATIVA",
    atualizadoEm: "2024-05-10T12:00:00Z"
  }
};

export async function mockFetchCnpj(cnpj: string): Promise<MockCnpjResponse> {
  const normalized = cnpj.replace(/\D/g, "");
  const entry =
    REGISTRY[normalized] ??
    {
      cnpj: normalized.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5"),
      razaoSocial: "Contribuinte Genérico Mock",
      nomeFantasia: "Sem Registro",
      situacaoCadastral: normalized.endsWith("0") ? "SUSPENSA" : "ATIVA",
      atualizadoEm: new Date().toISOString()
    };

  await new Promise((resolve) => setTimeout(resolve, 150));
  return entry;
}
