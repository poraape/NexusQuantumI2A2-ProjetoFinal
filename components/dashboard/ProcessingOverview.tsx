import React from 'react';
import { Card, Text } from '@tremor/react';
import { MetricCard } from './MetricCard';
import { ProcessingMetrics } from '../../types.ts';

const formatBytes = (value = 0) => {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let size = value / 1024;
  let idx = 0;
  while (size >= 1024 && idx < units.length - 1) {
    size /= 1024;
    idx += 1;
  }
  return `${size.toFixed(1)} ${units[idx]}`;
};

const formatNumber = (value = 0) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value);

export const ProcessingOverview: React.FC<{ metrics?: ProcessingMetrics }> = ({ metrics }) => {
  if (!metrics) return null;

  const summaryCards = [
    { title: 'Arquivos enviados', value: formatNumber(metrics.totalUploadedFiles) },
    { title: 'Tamanho total armazenado', value: formatBytes(metrics.totalStoredBytes) },
    { title: 'Artefatos extraídos', value: formatNumber(metrics.totalArtifacts) },
    { title: 'Chunks indexados', value: formatNumber(metrics.totalChunks) },
    { title: 'Caracteres analisados', value: formatNumber(metrics.totalCharacters) },
    { title: 'Documentos únicos', value: formatNumber(metrics.distinctDocuments) },
  ];

  const entityLines = [
    `${metrics.entityCoverage.cnpjs} CNPJs detectados`,
    `${metrics.entityCoverage.monetaryValues} valores monetários identificados`,
    `${metrics.entityCoverage.emails} e-mails registrados`,
  ];

  return (
    <Card className="bg-bg-secondary/60 border border-border-glass shadow-glass">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-semibold text-content-emphasis">Visão completa da ingestão</h3>
          <Text className="text-xs text-content-default/70">
            Dados calculados em {new Date(metrics.captureTimestamp).toLocaleString('pt-BR')}
          </Text>
        </div>
        <div className="text-xs text-content-default/60">Entenda o conjunto completo de arquivos</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {summaryCards.map(card => (
          <MetricCard key={card.title} title={card.title} value={card.value} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <Card className="bg-bg-secondary/70 border border-border-glass">
          <h4 className="text-sm font-semibold text-content-default mb-2">Distribuição por tipo</h4>
          {metrics.fileTypeBreakdown.length === 0 ? (
            <Text className="text-xs text-content-default/60">Nenhum tipo identificado ainda.</Text>
          ) : (
            metrics.fileTypeBreakdown.map(type => (
              <div key={type.category} className="flex justify-between border-b border-border-glass/60 py-2 last:border-b-0">
                <Text className="text-xs text-content-default">{type.category}</Text>
                <div className="text-right">
                  <Text className="text-xs text-content-emphasis">{formatNumber(type.count)} artefato(s)</Text>
                  <Text className="text-[11px] text-content-default/60">{formatBytes(type.bytes)}</Text>
                </div>
              </div>
            ))
          )}
        </Card>

        <Card className="bg-bg-secondary/70 border border-border-glass">
          <h4 className="text-sm font-semibold text-content-default mb-2">Documentos prioritários</h4>
          {metrics.documents.length === 0 ? (
            <Text className="text-xs text-content-default/60">Aguardando completa extração.</Text>
          ) : (
            metrics.documents.map(doc => (
              <div key={doc.hash} className="mb-3 last:mb-0">
                <p className="text-sm font-semibold text-content-emphasis truncate">{doc.fileName}</p>
                <Text className="text-[11px] text-content-default/70">
                  {doc.artifactCount} artefato(s) · {doc.chunkCount} chunk(s) · {formatBytes(doc.sizeBytes)}
                </Text>
                <Text className="text-[11px] text-content-default/60">{doc.detectionCategory}</Text>
              </div>
            ))
          )}
        </Card>
      </div>

      <div className="mt-4 space-y-1">
        {entityLines.map(line => (
          <Text key={line} className="text-xs text-content-default/70">
            {line}
          </Text>
        ))}
      </div>
    </Card>
  );
};
