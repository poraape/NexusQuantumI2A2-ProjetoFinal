// backend/services/storage.js
/**
 * Simple local storage service that persists uploaded files on disk,
 * computes content hashes for deduplication, and exposes helpers to
 * retrieve file contents later in the pipeline.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TMP_DIR = process.env.UPLOAD_TMP_DIR || path.join(__dirname, '..', '..', '.uploads', 'tmp');
const STORAGE_DIR = process.env.UPLOAD_STORAGE_DIR || path.join(__dirname, '..', '..', '.uploads', 'objects');

function ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function init() {
    ensureDirSync(TMP_DIR);
    ensureDirSync(STORAGE_DIR);
}

function getTmpDir() {
    return TMP_DIR;
}

function getStorageDir() {
    return STORAGE_DIR;
}

async function hashFile(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', chunk => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

async function persistUploadedFile(file) {
    const { path: tempPath, originalname, mimetype, size } = file;
    const checksum = await hashFile(tempPath);
    const storedPath = path.join(STORAGE_DIR, checksum);

    const alreadyExists = fs.existsSync(storedPath);
    if (!alreadyExists) {
        await fs.promises.rename(tempPath, storedPath);
    } else {
        // Duplicate upload, discard temporary instance.
        await fs.promises.unlink(tempPath);
    }

    return {
        hash: checksum,
        size,
        originalName: originalname,
        mimeType: mimetype,
        storedPath,
    };
}

async function persistUploadedFiles(files = []) {
    const results = [];
    for (const file of files) {
        try {
            const meta = await persistUploadedFile(file);
            results.push(meta);
        } catch (error) {
            // Clean up temp file on failure before propagating.
            if (file?.path && fs.existsSync(file.path)) {
                await fs.promises.unlink(file.path).catch(() => {});
            }
            throw error;
        }
    }
    return results;
}

async function readFileBuffer(hash) {
    const storedPath = path.join(STORAGE_DIR, hash);
    return fs.promises.readFile(storedPath);
}

function createReadStream(hash) {
    const storedPath = path.join(STORAGE_DIR, hash);
    return fs.createReadStream(storedPath);
}

module.exports = {
    init,
    getTmpDir,
    getStorageDir,
    persistUploadedFiles,
    readFileBuffer,
    createReadStream,
};
