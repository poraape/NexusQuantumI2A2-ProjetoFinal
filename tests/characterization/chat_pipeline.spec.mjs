import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function run({ assert }) {
  const chatService = await readFile(join(__dirname, '../../services/chatService.ts'), 'utf8');
  assert(chatService.includes('getChatResponse'), 'chatService.ts deve manter getChatResponse.');
  assert(chatService.includes('searchIndex'), 'chatService.ts precisa consultar contextMemory.');

  const contextMemory = await readFile(join(__dirname, '../../services/contextMemory.ts'), 'utf8');
  assert(contextMemory.includes('createAndStoreIndex'), 'contextMemory.ts deve fornecer índice vetorial local.');
  assert(contextMemory.includes('storeLastReportSummary'), 'contextMemory.ts precisa armazenar último resumo.');
}
