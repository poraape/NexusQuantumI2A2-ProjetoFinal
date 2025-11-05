import { appendFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { performance } from 'node:perf_hooks';

const execFileAsync = promisify(execFile);

const iterations = Number(process.env.ITERATIONS || 30);
const endpoint = process.env.SERVERLESS_ENDPOINT;
const payload = process.env.SERVERLESS_PAYLOAD || '{}';
const outputFile = process.env.OUTPUT || 'benchmarks/perf/serverless-coldstart.json';

if (!endpoint) {
  console.error('SERVERLESS_ENDPOINT não definido');
  process.exit(1);
}

await writeFile(outputFile, '[\n', 'utf-8');

for (let i = 0; i < iterations; i += 1) {
  const start = performance.now();
  try {
    await execFileAsync('curl', ['-s', '-o', '/dev/null', '-w', '%{time_total}', '-X', 'POST', endpoint, '-d', payload]);
  } catch (err) {
    console.error(`Falha na iteração ${i + 1}:`, err.message);
  }
  const end = performance.now();
  const entry = {
    iteration: i + 1,
    durationMs: end - start,
    timestamp: new Date().toISOString()
  };
  const suffix = i === iterations - 1 ? '\n]\n' : ',\n';
  await appendFile(outputFile, `${JSON.stringify(entry)}${suffix}`);
  console.log(`Iteração ${i + 1}: ${entry.durationMs.toFixed(2)} ms`);
}
