import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const specsDir = new URL('./', import.meta.url);

const files = (await readdir(specsDir))
  .filter(name => name.endsWith('.spec.mjs'))
  .sort();

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

for (const file of files) {
  const modulePath = new URL(file, specsDir);
  const spec = await import(modulePath.href);
  if (typeof spec.run !== 'function') {
    throw new Error(`Spec ${file} does not export a run() function`);
  }
  await spec.run({ assert });
  console.log(`✔ ${file}`);
}

console.log(`Executed ${files.length} characterization specs.`);
