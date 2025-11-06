// backend/routes/metrics.js
const express = require('express');
const router = express.Router();
const metrics = require('../services/metrics');

module.exports = () => {
    router.get('/', (req, res) => {
        const acceptsProm = req.headers.accept && req.headers.accept.includes('text/plain');
        if (acceptsProm) {
            res.type('text/plain').send(metrics.formatPrometheus());
            return;
        }
        res.status(200).json(metrics.getSnapshot());
    });

    return router;
};
