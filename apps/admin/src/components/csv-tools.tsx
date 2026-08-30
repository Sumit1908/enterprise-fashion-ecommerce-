'use client';

import { useRef, useState } from 'react';
import { apiDownload, apiFetch } from '@/lib/client';

interface ImportReport {
  productsProcessed: number;
  created: number;
  updated: number;
  variantsUpserted: number;
  errors: { slug: string; message: string }[];
}

export function CsvTools({ onImported }: { onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<null | 'export' | 'import'>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doExport() {
    setBusy('export');
    setError(null);
    try {
      await apiDownload('/admin/products/export.csv', 'slay-products.csv');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function doImport(file: File) {
    setBusy('import');
    setError(null);
    setReport(null);
    try {
      const csv = await file.text();
      const result = await apiFetch<ImportReport>('/admin/products/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setReport(result);
      onImported();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        <button
          onClick={doExport}
          disabled={busy !== null}
          className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy === 'export' ? 'Exporting…' : 'Export CSV'}
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
          className="rounded-md border border-[var(--color-line)] px-3 py-2 text-sm disabled:opacity-50"
        >
          {busy === 'import' ? 'Importing…' : 'Import CSV'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
          }}
        />
      </div>

      {error && <p className="text-xs text-[var(--color-bad)]">{error}</p>}

      {report && (
        <div className="max-w-sm rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] p-3 text-xs">
          <p className="font-medium">
            {report.created} created · {report.updated} updated · {report.variantsUpserted} variants
          </p>
          {report.errors.length > 0 ? (
            <ul className="mt-2 space-y-1 text-[var(--color-bad)]">
              {report.errors.slice(0, 8).map((err, i) => (
                <li key={i}>
                  {err.slug}: {err.message}
                </li>
              ))}
              {report.errors.length > 8 && <li>+{report.errors.length - 8} more…</li>}
            </ul>
          ) : (
            <p className="mt-1 text-[var(--color-good)]">No errors.</p>
          )}
        </div>
      )}
    </div>
  );
}
