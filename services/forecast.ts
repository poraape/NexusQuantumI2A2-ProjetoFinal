// services/forecast.ts
import { DocumentoFiscalDetalhado, ForecastResult, MonthlyData } from '../types.ts';

function agruparPorMes(documentos: DocumentoFiscalDetalhado[]): { [month: string]: MonthlyData } {
  const grupos: { [month: string]: MonthlyData } = {};
  
  documentos.forEach(doc => {
    const dataEmissao = doc.ide?.dhEmi; // Formato esperado: YYYY-MM-DDTHH:MM:SS-ZZ:ZZ
    if (typeof dataEmissao !== 'string' || dataEmissao.length < 7) return;

    const mes = dataEmissao.slice(0, 7); // Extrai 'YYYY-MM'
    
    if (!grupos[mes]) {
      grupos[mes] = { total: 0, impostos: 0 };
    }
    
    grupos[mes].total += parseFloat(doc.total?.vNF || 0);
    grupos[mes].impostos += doc.valorImpostos || 0;
  });

  return grupos;
}

export function calcularPrevisoes(documentos: DocumentoFiscalDetalhado[], meses = 6): ForecastResult | null {
  if (!documentos || documentos.length === 0) return null;

  const porMes = agruparPorMes(documentos);
  const mesesOrdenados = Object.keys(porMes).sort();

  if (mesesOrdenados.length === 0) return null;

  const ultimosMeses = mesesOrdenados.slice(-meses);
  const dadosParaMedia = ultimosMeses.map(mes => porMes[mes]);
  
  if (dadosParaMedia.length === 0) return null;

  const mediaFaturamento = dadosParaMedia.reduce((acc, val) => acc + val.total, 0) / dadosParaMedia.length;
  const mediaImpostos = dadosParaMedia.reduce((acc, val) => acc + val.impostos, 0) / dadosParaMedia.length;

  return {
    previsaoProximoMes: {
      faturamento: mediaFaturamento,
      impostos: mediaImpostos
    },
    historicoMensal: porMes
  };
}