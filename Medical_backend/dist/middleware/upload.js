"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploader = uploader;
exports.publicUrl = publicUrl;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_crypto_1 = __importDefault(require("node:crypto"));
const multer_1 = __importDefault(require("multer"));
const env_1 = require("../config/env");
const ApiError_1 = require("../utils/ApiError");
const ALLOWED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
]);
const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);
const uploadRoot = node_path_1.default.resolve(process.cwd(), env_1.env.UPLOAD_DIR);
function ensureDir(dir) {
    const target = node_path_1.default.join(uploadRoot, dir);
    node_fs_1.default.mkdirSync(target, { recursive: true });
    return target;
}
/** Creates a disk-storage uploader writing into uploads/<folder>. */
function uploader(folder) {
    const storage = multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, ensureDir(folder)),
        filename: (_req, file, cb) => {
            const ext = node_path_1.default.extname(file.originalname).toLowerCase();
            cb(null, `${Date.now()}-${node_crypto_1.default.randomBytes(8).toString('hex')}${ext}`);
        },
    });
    return (0, multer_1.default)({
        storage,
        limits: { fileSize: env_1.env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 10 },
        fileFilter: (_req, file, cb) => {
            const ext = node_path_1.default.extname(file.originalname).toLowerCase();
            if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
                return cb(ApiError_1.ApiError.badRequest('Only JPG, PNG, WEBP and PDF files are allowed'));
            }
            cb(null, true);
        },
    });
}
/** Converts a stored multer file into the public URL persisted on records. */
function publicUrl(folder, filename) {
    return `${env_1.env.PUBLIC_UPLOAD_BASE_URL.replace(/\/$/, '')}/${folder}/${filename}`;
}
//# sourceMappingURL=upload.js.map