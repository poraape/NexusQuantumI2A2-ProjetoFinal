import { writeFile } from 'node:fs/promises';

export async function runBenchmark({ client, iterations = 100 }) {
  const results = [];
  for (let i = 0; i < iterations; i += 1) {
    const start = performance.now();
    await client();
    const end = performance.now();
    results.push(end - start);
  }
  return {
    iterations,
    p95: percentile(results, 95),
    avg: average(results)
  };
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

function average(values) {
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('Use este módulo importando runBenchmark em scripts específicos.');
  await writeFile('benchmarks/cache.json', JSON.stringify({ message: 'executar via script dedicado' }, null, 2));
}
