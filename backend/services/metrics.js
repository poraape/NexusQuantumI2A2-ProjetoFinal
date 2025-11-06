// backend/services/metrics.js
/**
 * Minimal in-memory metrics collector with Prometheus-compatible exposition format.
 * Keeps dependencies zero while giving visibility during Phase 0.
 */

const counters = new Map();
const gauges = new Map();
const summaries = new Map();

function sanitiseName(name) {
    return name.replace(/[^a-zA-Z0-9_]/g, '_');
}

function incrementCounter(name, value = 1) {
    const key = sanitiseName(name);
    const current = counters.get(key) ?? 0;
    counters.set(key, current + value);
    return counters.get(key);
}

function setGauge(name, value) {
    const key = sanitiseName(name);
    gauges.set(key, Number(value));
    return gauges.get(key);
}

function observeSummary(name, value) {
    const key = sanitiseName(name);
    const existing = summaries.get(key) ?? { count: 0, sum: 0, min: Infinity, max: -Infinity };
    const numeric = Number(value);
    const next = {
        count: existing.count + 1,
        sum: existing.sum + numeric,
        min: Math.min(existing.min, numeric),
        max: Math.max(existing.max, numeric),
    };
    summaries.set(key, next);
    return next;
}

function getSnapshot() {
    return {
        counters: Object.fromEntries(counters),
        gauges: Object.fromEntries(gauges),
        summaries: Object.fromEntries(
            Array.from(summaries.entries()).map(([key, stats]) => [
                key,
                {
                    ...stats,
                    avg: stats.count === 0 ? 0 : stats.sum / stats.count,
                },
            ])
        ),
    };
}

function formatPrometheus() {
    const lines = [];

    counters.forEach((value, key) => {
        lines.push(`# TYPE ${key} counter`);
        lines.push(`${key} ${value}`);
    });

    gauges.forEach((value, key) => {
        lines.push(`# TYPE ${key} gauge`);
        lines.push(`${key} ${value}`);
    });

    summaries.forEach((stats, key) => {
        const avg = stats.count === 0 ? 0 : stats.sum / stats.count;
        lines.push(`# TYPE ${key} summary`);
        lines.push(`${key}_count ${stats.count}`);
        lines.push(`${key}_sum ${stats.sum}`);
        lines.push(`${key}_avg ${avg}`);
        lines.push(`${key}_min ${stats.min === Infinity ? 0 : stats.min}`);
        lines.push(`${key}_max ${stats.max === -Infinity ? 0 : stats.max}`);
    });

    return `${lines.join('\n')}\n`;
}

module.exports = {
    incrementCounter,
    setGauge,
    observeSummary,
    getSnapshot,
    formatPrometheus,
};
