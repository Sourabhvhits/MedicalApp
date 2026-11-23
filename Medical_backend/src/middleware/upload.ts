import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { env } from '../config/env';
import { ApiError } from '../utils/ApiError';

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

const ALLOWED_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.pdf']);

const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);

function ensureDir(dir: string): string {
  const target = path.join(uploadRoot, dir);
  fs.mkdirSync(target, { recursive: true });
  return target;
}

/** Creates a disk-storage uploader writing into uploads/<folder>. */
export function uploader(folder: string) {
  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, ensureDir(folder)),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
    },
  });

  return multer({
    storage,
    limits: { fileSize: env.MAX_UPLOAD_SIZE_MB * 1024 * 1024, files: 10 },
    fileFilter: (_req: Request, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      if (!ALLOWED_MIME.has(file.mimetype) || !ALLOWED_EXT.has(ext)) {
        return cb(ApiError.badRequest('Only JPG, PNG, WEBP and PDF files are allowed'));
      }
      cb(null, true);
    },
  });
}

/** Converts a stored multer file into the public URL persisted on records. */
export function publicUrl(folder: string, filename: string): string {
  return `${env.PUBLIC_UPLOAD_BASE_URL.replace(/\/$/, '')}/${folder}/${filename}`;
}
