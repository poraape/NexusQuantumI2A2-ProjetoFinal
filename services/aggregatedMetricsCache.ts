import type { AggregatedMetricsSummary, GeneratedReport } from '../types.ts';

const CACHE_PREFIX = 'NEXUS_AGGREGATED_METRICS_';

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

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

const safeParse = <T>(value: string | null): T | null => {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export const buildAggregatedMetricsSummary = (report: GeneratedReport | null, files: File[]): AggregatedMetricsSummary | null => {
  if (!report) return null;
  const metrics = report.processingMetrics;
  const totalFiles = metrics?.totalUploadedFiles ?? Math.max(files.length, 0);
  const totalBytes =
    metrics?.totalStoredBytes ??
    files.reduce((acc, file) => acc + (file?.size || 0), 0);
  const totalArtifacts = metrics?.totalArtifacts ?? Math.max(files.length, 0);
  const totalChunks = metrics?.totalChunks ?? 0;
  const distinctDocuments = metrics?.distinctDocuments ?? Math.max(files.length, 0);
  const averageArtifactsPerFile = totalFiles > 0 ? totalArtifacts / totalFiles : totalArtifacts;
  const captureTimestamp = metrics?.captureTimestamp || new Date().toISOString();

  const summaryText = `Consolidação ativa para ${totalFiles} arquivo(s) (${formatBytes(totalBytes)}) processados até ${new Date(
    captureTimestamp,
  ).toLocaleString('pt-BR')}.`;

  return {
    totalFiles,
    totalBytes,
    totalArtifacts,
    totalChunks,
    distinctDocuments,
    averageArtifactsPerFile,
    summaryText,
    captureTimestamp,
  };
};

export const cacheAggregatedMetrics = (jobId: string, summary: AggregatedMetricsSummary) => {
  if (!jobId || !hasStorage()) return;
  try {
    localStorage.setItem(`${CACHE_PREFIX}${jobId}`, JSON.stringify(summary));
  } catch {
    // Ignore storage failures (quota, private browsing)
  }
};

export const getCachedAggregatedMetrics = (jobId?: string): AggregatedMetricsSummary | null => {
  if (!jobId || !hasStorage()) return null;
  return safeParse<AggregatedMetricsSummary>(localStorage.getItem(`${CACHE_PREFIX}${jobId}`));
};
