import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function run({ assert }) {
  const exporterSource = await readFile(join(__dirname, '../../services/exporter.ts'), 'utf8');
  assert(exporterSource.includes('extrairDadosParaExportacao'), 'exporter.ts deve expor extrairDadosParaExportacao.');
  assert(exporterSource.includes('gerarCsvERP'), 'exporter.ts deve manter geração CSV.');
  assert(exporterSource.includes('validateDocumentCompleto') || exporterSource.includes('validarDocumentoCompleto'), 'exporter.ts precisa acionar validação de regras.');

  const rulesValidatorSource = await readFile(join(__dirname, '../../services/rulesValidator.ts'), 'utf8');
  assert(rulesValidatorSource.includes('validateDocumentCompleto') || rulesValidatorSource.includes('validarDocumentoCompleto'), 'rulesValidator.ts deve conter rotina de validação.');
}
