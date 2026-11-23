'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, Upload } from 'lucide-react';
import { ApiError, download, upload } from '@/lib/api-client';
import { Button, Modal } from '@/components/ui';

interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

/**
 * "Export catalogue" + "Import CSV" pair, shared across the three product
 * lists (admin master, vendor, retailer) that all grew the same matching
 * backend endpoints (`{basePath}/export`, `{basePath}/import`) — see
 * TASKS.md #5 / #21. A re-imported export round-trips: rows with a
 * matching SKU update in place instead of duplicating.
 */
export function CatalogImportExport({
  basePath,
  filename,
  onImported,
}: {
  basePath: string;
  filename: string;
  onImported?: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const runExport = async () => {
    setExporting(true);
    try {
      await download(`${basePath}/export`, { format: 'csv' }, `${filename}.csv`);
    } catch {
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleFile = async (file: File) => {
    setImporting(true);
    try {
      const data = new FormData();
      data.append('file', file);
      const res = await upload<ImportResult>(`${basePath}/import`, data);
      setResult(res);
      const total = res.added + res.updated + res.skipped + res.errors.length;
      toast.success(`Imported ${res.added + res.updated} of ${total} rows`);
      onImported?.();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'Import failed');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        variant="outline"
        icon={<Download className="h-4 w-4" />}
        loading={exporting}
        onClick={runExport}
      >
        Export
      </Button>
      <Button
        variant="outline"
        icon={<Upload className="h-4 w-4" />}
        loading={importing}
        onClick={() => fileRef.current?.click()}
      >
        Import CSV
      </Button>

      <Modal
        open={Boolean(result)}
        onClose={() => setResult(null)}
        title="Import result"
        size="sm"
        footer={<Button onClick={() => setResult(null)}>Close</Button>}
      >
        {result ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-success-soft p-2">
                <p className="text-lg font-semibold text-green-800">{result.added}</p>
                <p className="text-xs text-green-700">Added</p>
              </div>
              <div className="rounded-lg bg-brand-50 p-2">
                <p className="text-lg font-semibold text-brand-800">{result.updated}</p>
                <p className="text-xs text-brand-700">Updated</p>
              </div>
              <div className="rounded-lg bg-danger-soft p-2">
                <p className="text-lg font-semibold text-red-800">{result.errors.length}</p>
                <p className="text-xs text-red-700">Errors</p>
              </div>
            </div>
            {result.errors.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg bg-ink-50 p-2 text-xs text-ink-700">
                {result.errors.map((error) => (
                  <li key={error.row}>
                    Row {error.row}: {error.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
