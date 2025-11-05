import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function run({ assert }) {
  const fixturesDir = join(__dirname, 'fixtures');
  const xmlPath = join(fixturesDir, 'sample-nfe.xml');
  const xmlContent = await readFile(xmlPath, 'utf8');
  const hash = createHash('sha256').update(xmlContent).digest('hex');

  const baseline = JSON.parse(await readFile(join(__dirname, 'hash.json'), 'utf8'));
  assert(baseline['sample-nfe.xml'] === hash, 'sample-nfe.xml hash divergiu do baseline.');

  const appSource = await readFile(join(__dirname, '../../App.tsx'), 'utf8');
  assert(appSource.includes('handleFileUpload'), 'App.tsx deve manter handleFileUpload para compatibilidade.');
  assert(appSource.includes('generateReportFromFiles'), 'App.tsx deve continuar a orquestrar generateReportFromFiles.');

  const dashboardSource = await readFile(join(__dirname, '../../components/dashboard/Dashboard.tsx'), 'utf8');
  assert(dashboardSource.includes('ExecutiveAnalysis'), 'Dashboard precisa renderizar ExecutiveAnalysis.');
  assert(dashboardSource.includes('InteractiveChat'), 'Dashboard precisa renderizar InteractiveChat.');
}
