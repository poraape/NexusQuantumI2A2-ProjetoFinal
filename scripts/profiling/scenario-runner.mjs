import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { spawn } from 'node:child_process';

const [,, scenario, outFile] = process.argv;

if (!scenario || !outFile) {
  console.error('Usage: node scenario-runner.mjs <scenario> <outFile>');
  process.exit(1);
}

const workloads = {
  '{SCENARIO_1}': ['npm', ['run', 'test', '--', '--scenario', '{SCENARIO_1}']],
  '{SCENARIO_2}': ['npm', ['run', 'test', '--', '--scenario', '{SCENARIO_2}']]
};

if (!(scenario in workloads)) {
  console.error(`Unknown scenario: ${scenario}`);
  process.exit(1);
}

const [command, args] = workloads[scenario];
const start = performance.now();

await new Promise((resolve, reject) => {
  const child = spawn(command, args, { stdio: 'inherit' });
  child.on('exit', code => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`${scenario} failed with exit code ${code}`));
    }
  });
});

const end = performance.now();

const summary = {
  scenario,
  command: `${command} ${args.join(' ')}`.trim(),
  durationMs: end - start,
  timestamp: new Date().toISOString(),
  metrics: {
    latencyP95Ms: null,
    memoryMb: null,
    ioWaitMs: null
  },
  notes: 'Populate metrics fields com dados coletados via profiler externo (clinic.js, node --prof, etc.).'
};

await writeFile(outFile, JSON.stringify(summary, null, 2), 'utf-8');
