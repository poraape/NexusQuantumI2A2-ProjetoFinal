import { readFile } from 'node:fs/promises';

export async function run({ assert }) {
  const baseline = JSON.parse(await readFile('tests/model_baseline.json', 'utf-8'));
  const candidate = JSON.parse(await readFile('tests/model_candidate.json', 'utf-8'));

  assert(candidate.metrics.execSummaryAccuracy >= baseline.metrics.execSummaryAccuracy - 0.02,
    'Precisão não pode degradar > 2 pontos percentuais');
  assert(candidate.metrics.hallucinationRate <= baseline.metrics.hallucinationRate,
    'Taxa de alucinação não pode aumentar');
}
