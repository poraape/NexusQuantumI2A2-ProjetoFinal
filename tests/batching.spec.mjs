export async function run({ assert }) {
  const mockQueue = [];
  const rule = {
    minBatchSize: 2,
    maxBatchSize: 4,
    maxWaitMs: 500
  };

  const enqueue = payload => mockQueue.push(payload);

  enqueue({ id: 'doc-1', tokens: 1200 });
  enqueue({ id: 'doc-2', tokens: 900 });

  const batch = buildBatch(mockQueue, rule);
  assert(batch.items.length === 2, 'Batch deve agrupar dois documentos');
  assert(batch.totalTokens === 2100, 'Total de tokens incorreto');

  enqueue({ id: 'doc-3', tokens: 5000 });
  const invalid = { ...rule, maxTokens: 4000 };
  const error = catchError(() => buildBatch(mockQueue, invalid));
  assert(/excede limite/.test(error.message), 'Deveria falhar quando excede tokens');
}

function buildBatch(queue, rule) {
  const batch = [];
  let tokens = 0;
  for (const item of queue) {
    const nextTokens = tokens + item.tokens;
    if (rule.maxTokens && nextTokens > rule.maxTokens) {
      throw new Error('Batch excede limite de tokens');
    }
    batch.push(item);
    tokens = nextTokens;
    if (batch.length === rule.maxBatchSize) break;
  }
  if (batch.length < rule.minBatchSize) {
    throw new Error('Batch não atingiu tamanho mínimo');
  }
  return { items: batch, totalTokens: tokens };
}

function catchError(fn) {
  try {
    fn();
  } catch (err) {
    return err;
  }
  throw new Error('Esperava falha mas função teve sucesso');
}
