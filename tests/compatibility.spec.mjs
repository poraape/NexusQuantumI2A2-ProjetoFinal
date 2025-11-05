import { readFile } from 'node:fs/promises';

export async function run({ assert }) {
  const agentOutputSchema = JSON.parse(await readFile('schemas/msg/1.0.0/agent.output.json', 'utf-8'));
  const properties = agentOutputSchema.properties || {};
  assert('agentVersion' in properties, 'agent.output deve incluir agentVersion');
  assert(properties.agentVersion.type === 'string', 'agentVersion precisa ser string');
}
