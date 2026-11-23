import { Readable } from 'node:stream';
import path from 'node:path';
import multer from 'multer';
import ExcelJS from 'exceljs';
import { ApiError } from './ApiError';

/** Memory-storage upload for a single CSV file — the other `uploader()` in
 * `middleware/upload.ts` is disk-storage and image/PDF-only, which doesn't
 * fit a file we need to parse in-process and never persist. */
export const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.csv') {
      return cb(ApiError.badRequest('Only .csv files are supported'));
    }
    cb(null, true);
  },
}).single('file');

/** Parses an uploaded CSV into plain string-keyed rows, header row first.
 * Values are kept as raw strings — callers already coerce with Zod
 * (`z.coerce.number()` etc.), so this doesn't second-guess types itself. */
export async function parseCsvBuffer(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = await workbook.csv.read(Readable.from(buffer), { map: (value: unknown) => value });

  let headers: string[] = [];
  const rows: Record<string, string>[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = (row.values as unknown[]).slice(1).map((v) => String(v ?? '').trim());
    if (rowNumber === 1) {
      headers = values;
      return;
    }
    if (values.every((v) => v === '')) return; // skip blank trailing lines
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });
    rows.push(record);
  });

  return rows;
}

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: ImportRowError[];
}

/** Runs `processor` over every parsed row, collecting a per-row error instead
 * of failing the whole file on one bad line — the point of a bulk import. */
export async function runImport(
  rows: Record<string, string>[],
  processor: (row: Record<string, string>, index: number) => Promise<'added' | 'updated' | 'skipped'>,
): Promise<ImportResult> {
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };

  for (let index = 0; index < rows.length; index += 1) {
    try {
      const outcome = await processor(rows[index], index);
      result[outcome] += 1;
    } catch (error) {
      // +2: the header row, plus the 1-indexing spreadsheet software shows.
      result.errors.push({
        row: index + 2,
        message: error instanceof ApiError ? error.message : error instanceof Error ? error.message : 'Import failed',
      });
    }
  }

  return result;
}
