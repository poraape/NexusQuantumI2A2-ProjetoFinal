// backend/services/queue.js
/**
 * Centralized BullMQ setup for the job processing pipeline.
 * Provides named queues for each stage and a helper to register workers.
 */

const { Queue, Worker } = require('bullmq');
const { redisOptions } = require('./redisOptions');

const connection = redisOptions();

const queues = {
    extraction: new Queue('extraction', { connection }),
    validation: new Queue('validation', { connection }),
    audit: new Queue('audit', { connection }),
    classification: new Queue('classification', { connection }),
    analysis: new Queue('analysis', { connection }),
    indexing: new Queue('indexing', { connection }),
};

function registerWorker(queueName, processor, opts = {}) {
    return new Worker(queueName, processor, {
        connection,
        concurrency: opts.concurrency || 1,
    });
}

module.exports = {
    queues,
    registerWorker,
    connection,
};
