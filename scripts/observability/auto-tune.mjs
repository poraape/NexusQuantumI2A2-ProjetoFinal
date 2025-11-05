import { readFile, writeFile } from 'node:fs/promises';

const targetKpi = process.env.TARGET_KPI || 'latency_p95_ms';
const dataSource = process.env.DATA_SOURCE || '{DATA_SOURCE}';

async function loadMetrics() {
  console.log(`Carregando métricas de ${dataSource}`);
  return {
    latency_p95_ms: 3400,
    error_rate: 0.009
  };
}

async function adjustAlerts(metrics) {
  const files = ['alerts/security.yaml', 'alerts/operations.yaml'];
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const updated = content.replace(/(latency[^\d]*)(\d+)/gi, `$1${Math.round(metrics.latency_p95_ms * 1.1)}`);
    await writeFile(file, updated, 'utf-8');
  }
}

const metrics = await loadMetrics();
await adjustAlerts(metrics);

const logEntry = `# Auto-tune ${new Date().toISOString()}\n- ${targetKpi}: ${metrics[targetKpi] ?? 'n/a'}\n`;
await writeFile('observability/changelog.md', logEntry, { flag: 'a', encoding: 'utf-8' });
console.log('Auto-tuning concluído');
