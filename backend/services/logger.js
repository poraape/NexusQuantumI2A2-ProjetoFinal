// backend/services/logger.js
/**
 * Lightweight structured logger used across the backend.
 * Avoids external dependencies while still producing JSON logs that are easy to parse.
 */

const LEVELS = {
    fatal: 10,
    error: 20,
    warn: 30,
    info: 40,
    debug: 50,
    trace: 60,
};

const DEFAULT_LEVEL = process.env.LOG_LEVEL && LEVELS[process.env.LOG_LEVEL]
    ? process.env.LOG_LEVEL
    : 'info';

const threshold = LEVELS[DEFAULT_LEVEL];

function serialize(value) {
    if (value === undefined) return undefined;
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }
    return value;
}

function log(level, message, meta = {}) {
    const levelValue = LEVELS[level] ?? LEVELS.info;
    if (levelValue > threshold) return;

    const payload = {
        level,
        time: new Date().toISOString(),
        msg: message,
    };

    Object.entries(meta).forEach(([key, value]) => {
        payload[key] = serialize(value);
    });

    if (levelValue <= LEVELS.error) {
        console.error(JSON.stringify(payload));
    } else {
        console.log(JSON.stringify(payload));
    }
}

function createLogger(defaultMeta = {}) {
    const api = {};

    Object.keys(LEVELS).forEach(level => {
        api[level] = (message, meta = {}) => log(level, message, { ...defaultMeta, ...meta });
    });

    api.child = (meta = {}) => createLogger({ ...defaultMeta, ...meta });

    return api;
}

module.exports = createLogger();
