// services/rulesValidator.ts
import { DocumentoFiscalDetalhado } from '../types.ts';
import { getCachedCnpjValidation, storeCnpjValidation } from './contextMemory.ts';

// --- Datasets for Validation (Expanded) ---

const COMMON_CFOPS = new Set([
  // Entradas
  '1101', '1102', '1111', '1113', '1116', '1117', '1118', '1120', '1121', '1122', '1124', '1125', '1126', '1128',
  '1201', '1202', '1203', '1204', '1205', '1206', '1207', '1208', '1209', '1212',
  '1301', '1302', '1303', '1304', '1305', '1306', '1351', '1352', '1353', '1354', '1355', '1356', '1360',
  '1401', '1403', '1406', '1407', '1408', '1409', '1410', '1411', '1414', '1415',
  '1551', '1556', '1651', '1652', '1901', '1904', '1915', '1916', '1949',
  '2101', '2102', '2126', '2128', '2201', '2202', '2303', '2352', '2403', '2551', '2556', '2901', '2915', '2949',
  '3101', '3102', '3201', '3202', '3551', '3556', '3949',
  // Saídas
  '5101', '5102', '5103', '5104', '5105', '5106', '5109', '5110', '5111', '5112', '5113', '5114', '5115', '5116', '5117', '5118', '5119', '5120', '5122', '5123', '5124', '5125',
  '5201', '5202', '5208', '5209', '5210',
  '5351', '5352', '5353', '5354', '5355', '5356', '5357', '5359', '5360',
  '5401', '5402', '5403', '5405', '5408', '5409', '5410', '5411', '5412', '5413', '5414', '5415',
  '5551', '5556', '5652', '5656', '5901', '5902', '5904', '5915', '5929', '5933', '5949',
  '6101', '6102', '6108', '6117', '6201', '6202', '6352', '6403', '6551', '6556', '6901', '6915', '6933', '6949',
  '7101', '7102', '7201', '7202', '7358', '7551', '7949'
]);

const COMMON_CSTS_ICMS = new Set([ '00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90' ]);
const COMMON_CSOSN = new Set([ '101', '102', '103', '201', '202', '203', '300', '400', '500', '900' ]);

const NCM_CHAPTER_PREFIXES = new Set([
  '01','02','03','04','05','06','07','08','09','10','11','12','13','14','15','16','17','18','19','20','21','22','23','24',
  '25','26','27','28','29','30','31','32','33','34','35','36','37','38','39','40','41','42','43','44','45','46','47','48','49',
  '50','51','52','53','54','55','56','57','58','59','60','61','62','63','64','65','66','67','68','69','70','71','72','73',
  '74','75','76','78','79','80','81','82','83','84','85','86','87','88','89','90','91','92','93','94','95','96','97'
]);

export interface ValidationResult {
  status: 'ok' | 'warning' | 'error';
  issues: string[];
}

/**
 * Validates a CNPJ using a public API and caches the result.
 * @param cnpj The CNPJ string (only digits).
 * @returns The validation result or null on failure.
 */
async function validarCNPJComCache(cnpj: string): Promise<any | null> {
    if (!cnpj || !/^\d{14}$/.test(cnpj)) return { "erro": "Formato de CNPJ inválido" };
    
    const cached = getCachedCnpjValidation(cnpj);
    if (cached) {
        console.log(`[Validator] CNPJ ${cnpj} encontrado no cache.`);
        return cached;
    }
    
    try {
        const response = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
        if (!response.ok) throw new Error(`API retornou status ${response.status}`);
        const data = await response.json();
        storeCnpjValidation(cnpj, data);
        return data;
    } catch (err) {
        console.warn(`Falha na validação de CNPJ online para ${cnpj}:`, err);
        return null; // Return null on network or API failure
    }
}


/**
 * Performs a comprehensive validation of a document, including fiscal codes and CNPJ checks.
 * @param doc The detailed fiscal document object.
 * @returns A promise resolving to the validation result.
 */
export async function validarDocumentoCompleto(doc: DocumentoFiscalDetalhado): Promise<DocumentoFiscalDetalhado> {
  const issues: string[] = [];

  // Rule 1: Validate Total Value vs. Sum of Item Values
  const somaItens = doc.itens.reduce((acc, item) => acc + (parseFloat(item.vProd) || 0), 0);
  const valorTotalNota = parseFloat(doc.total?.vNF || 0);
  if (Math.abs(valorTotalNota - somaItens) > 0.01) {
    issues.push(`Divergência de totais: Valor total da nota (R$ ${valorTotalNota.toFixed(2)}) difere da soma dos itens (R$ ${somaItens.toFixed(2)}).`);
  }

  // Rule 2 & 3: Validate Emitter and Receiver CNPJ
  if (doc.emit?.CNPJ) {
      const result = await validarCNPJComCache(doc.emit.CNPJ);
      if (result?.erro) issues.push(`CNPJ do emitente (${doc.emit.CNPJ}) inválido ou não encontrado. Causa: ${result.detalhes || result.erro}`);
  }
  if (doc.dest?.CNPJ) {
      const result = await validarCNPJComCache(doc.dest.CNPJ);
      if (result?.erro) issues.push(`CNPJ do destinatário (${doc.dest.CNPJ}) inválido ou não encontrado. Causa: ${result.detalhes || result.erro}`);
  }

  const invalidCfops = new Set<string>();
  const invalidCsts = new Set<string>();
  const invalidNcms = new Set<string>();

  // Rule 4: Validate fiscal codes for each item
  doc.itens.forEach((item: any, index: number) => {
    const itemLabel = `Item #${item.nItem || index + 1} (${item.xProd?.slice(0, 20)}...)`;
    
    if (!item.cfop || !COMMON_CFOPS.has(item.cfop)) { invalidCfops.add(item.cfop); }
    
    const icmsNode = item.imposto?.ICMS;
    if (icmsNode) {
        const cstNodeKey = Object.keys(icmsNode)[0];
        const finalCst = cstNodeKey ? (icmsNode[cstNodeKey]?.CST || icmsNode[cstNodeKey]?.CSOSN) : null;
        if (!finalCst || (!COMMON_CSTS_ICMS.has(finalCst) && !COMMON_CSOSN.has(finalCst))) { invalidCsts.add(finalCst || 'N/A'); }
    } else {
        issues.push(`${itemLabel}: Bloco de imposto ICMS ausente.`);
    }
    
    if (!item.ncm || String(item.ncm).length !== 8 || !NCM_CHAPTER_PREFIXES.has(String(item.ncm).substring(0, 2))) { invalidNcms.add(item.ncm); }
  });

  if (invalidCfops.size > 0) issues.push(`CFOPs desconhecidos ou inválidos: ${[...invalidCfops].join(', ')}.`);
  if (invalidCsts.size > 0) issues.push(`CSTs/CSOSNs desconhecidos: ${[...invalidCsts].join(', ')}.`);
  if (invalidNcms.size > 0) issues.push(`NCMs com formato ou prefixo inválido: ${[...invalidNcms].join(', ')}.`);

  // Determine final status
  let status: 'ok' | 'warning' | 'error' = 'ok';
  if (issues.length > 0) status = issues.length > 3 ? 'error' : 'warning';

  doc.semaforoFiscal = status;
  doc.validationIssues = issues;

  if(status !== 'ok') {
      console.warn(`[Validator] Document ${doc.fileName} has issues (${status}):`, issues);
  }

  return doc;
}