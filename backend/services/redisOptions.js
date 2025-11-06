// backend/services/redisOptions.js
function redisOptions() {
    if (process.env.REDIS_URL) {
        return { url: process.env.REDIS_URL };
    }
    return {
        host: process.env.REDIS_HOST || '127.0.0.1',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
    };
}

module.exports = { redisOptions };
