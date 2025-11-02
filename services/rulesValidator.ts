// services/rulesValidator.ts
import { DocumentoFiscalDetalhado } from '../types.ts';

// --- Datasets for Validation (Simplified for MVP) ---
// Based on common Brazilian fiscal codes. This is not an exhaustive list.

const COMMON_CFOPS = new Set([
  '1101', '1102', '1201', '1202', '1351', '1352', '1401', '1403',
  '2101', '2102', '2201', '2202', '2351', '2352', '2401', '2403',
  '5101', '5102', '5116', '5117', '5401', '5403', '5405', '5901', '5902', '5904', '5915',
  '6101', '6102', '6116', '6117', '6401', '6403', '6404', '6901', '6902', '6904', '6915',
  '7101', '7102'
]);

// Common CST codes for ICMS (Regime Normal)
const COMMON_CSTS_ICMS = new Set([
  '00', '10', '20', '30', '40', '41', '50', '51', '60', '70', '90'
]);

// Common CSOSN codes for ICMS (Simples Nacional)
const COMMON_CSOSN = new Set([
  '101', '102', '103', '201', '202', '203', '300', '400', '500', '900'
]);

// NCM codes are vast. We'll validate structure and some common chapter prefixes.
const NCM_CHAPTER_PREFIXES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09', '10', // Animal & Veg products
  '25', '26', '27', // Mineral products
  '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', // Chemical products
  '39', '40', // Plastics & Rubber
  '44', '45', '46', // Wood
  '47', '48', '49', // Paper
  '61', '62', '63', // Textiles
  '72', '73', // Iron & Steel
  '84', '85', // Machinery & Electronics
  '87', // Vehicles
  '90', // Optical, Photo, Medical
  '94', '95', // Furniture & Toys
  '96', // Misc
]);

export interface ValidationResult {
  status: 'ok' | 'warning' | 'error';
  issues: string[];
}

/**
 * Validates a single document against a set of fiscal rules.
 * @param doc The detailed fiscal document object.
 * @returns A validation result with status and a list of issues.
 */
export function validarDocumento(doc: DocumentoFiscalDetalhado): ValidationResult {
  const issues: string[] = [];

  // Rule 1: Validate Total Value vs. Sum of Item Values
  const somaItens = doc.itens.reduce((acc, item) => acc + (parseFloat(item.vProd) || 0), 0);
  const valorTotalNota = parseFloat(doc.total?.vNF || 0);
  if (Math.abs(valorTotalNota - somaItens) > 0.01) {
    issues.push(`Divergência de totais: Valor total da nota (R$ ${valorTotalNota.toFixed(2)}) difere da soma dos itens (R$ ${somaItens.toFixed(2)}).`);
  }

  const invalidCfops = new Set<string>();
  const invalidCsts = new Set<string>();
  const invalidNcms = new Set<string>();

  // Rule 2: Validate fiscal codes for each item
  doc.itens.forEach((item: any, index: number) => {
    const itemLabel = `Item #${item.nItem || index + 1} (${item.xProd?.slice(0, 20)}...)`;
    
    // CFOP Validation
    if (!item.cfop) {
      issues.push(`${itemLabel}: CFOP ausente.`);
    } else if (item.cfop.length !== 4 || !/^[1-7]/.test(item.cfop)) {
        invalidCfops.add(item.cfop);
    }
    
    // CST/CSOSN Validation
    const icmsNode = item.imposto?.ICMS;
    if (icmsNode) {
        const cstNodeKey = Object.keys(icmsNode)[0]; // e.g., 'ICMS00', 'ICMSSN102'
        const cstNode = cstNodeKey ? icmsNode[cstNodeKey] : {};
        const finalCst = cstNode?.CST || cstNode?.CSOSN;

        if (!finalCst) {
          issues.push(`${itemLabel}: CST/CSOSN ausente no bloco ICMS.`);
        } else if (!COMMON_CSTS_ICMS.has(finalCst) && !COMMON_CSOSN.has(finalCst)) {
            invalidCsts.add(finalCst);
        }
    } else {
        issues.push(`${itemLabel}: Bloco de imposto ICMS ausente.`);
    }
    
    // NCM Validation
    if (!item.ncm) {
      issues.push(`${itemLabel}: NCM ausente.`);
    } else if (String(item.ncm).length !== 8 || !/^\d+$/.test(item.ncm)) {
        invalidNcms.add(item.ncm);
    } else if (!NCM_CHAPTER_PREFIXES.has(String(item.ncm).substring(0, 2))) {
        invalidNcms.add(item.ncm);
    }
  });

  if (invalidCfops.size > 0) {
      issues.push(`CFOPs com formato inválido ou incomum encontrados: ${[...invalidCfops].join(', ')}.`);
  }
  if (invalidCsts.size > 0) {
      issues.push(`CSTs/CSOSNs desconhecidos encontrados: ${[...invalidCsts].join(', ')}.`);
  }
  if (invalidNcms.size > 0) {
      issues.push(`NCMs com formato inválido ou prefixo desconhecido: ${[...invalidNcms].join(', ')}.`);
  }

  // Determine final status
  let status: 'ok' | 'warning' | 'error' = 'ok';
  if (issues.length > 0) {
    status = issues.length > 2 ? 'error' : 'warning';
  }

  return { status, issues };
}