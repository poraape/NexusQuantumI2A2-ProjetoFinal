import React from 'react';
import { MetricCard } from './MetricCard';
import type { AggregatedMetricsSummary } from '../../types.ts';

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

const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value);

export const AggregatedFileSummary: React.FC<{ summary: AggregatedMetricsSummary }> = ({ summary }) => {
  const { totalFiles, totalBytes, totalArtifacts, totalChunks, distinctDocuments, averageArtifactsPerFile } = summary;

  const cards = [
    { title: 'Arquivos consolidados', value: totalFiles.toString() },
    { title: 'Tamanho total', value: formatBytes(totalBytes) },
    { title: 'Artefatos extraídos', value: totalArtifacts.toString() },
    { title: 'Chunks indexados', value: totalChunks.toString() },
    { title: 'Documentos únicos', value: distinctDocuments.toString() },
    { title: 'Artefatos por arquivo', value: formatNumber(averageArtifactsPerFile) },
  ];

  return (
    <section className="bg-bg-secondary/60 border border-border-glass rounded-3xl shadow-glass p-5 space-y-4 mb-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-content-default/70 uppercase tracking-[0.2em]">Modelagem Unificada</p>
          <p className="text-content-emphasis font-semibold text-lg">Consolidação de todos os arquivos</p>
        </div>
        <span className="text-[11px] text-content-default/60">
          Atualizado em {new Date(summary.captureTimestamp).toLocaleString('pt-BR')}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map(card => (
          <MetricCard key={card.title} title={card.title} value={card.value} />
        ))}
      </div>

      <p className="text-[11px] text-content-default/70">{summary.summaryText}</p>
    </section>
  );
};
