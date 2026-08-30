'use client';

import { useRef, useState } from 'react';
import { apiUpload } from '@/lib/client';

export function MediaUploader({ onUploaded }: { onUploaded: (url: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const { url } = await apiUpload<{ url: string }>('/admin/media/upload', file);
        onUploaded(url);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = '';
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="rounded-md border border-dashed border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-muted)] hover:border-[var(--color-brand)] disabled:opacity-50"
      >
        {busy ? 'Uploading…' : 'Upload images / video'}
      </button>
      <input
        ref={ref}
        type="file"
        accept="image/*,video/mp4,video/webm"
        multiple
        hidden
        onChange={(e) => void handle(e.target.files)}
      />
      {error && <p className="mt-1 text-xs text-[var(--color-bad)]">{error}</p>}
    </div>
  );
}
