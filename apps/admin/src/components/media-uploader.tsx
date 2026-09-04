'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDelete, apiFetch, apiUpload } from '@/lib/client';

interface MediaConfig {
  driver: 's3' | 'local';
  persistent: boolean;
  endpointConfigured?: boolean;
  maxMb: number;
  allowVideo: boolean;
  acceptedTypes: string[];
}

interface Pending {
  id: string;
  name: string;
  preview: string;
  pct: number;
  error: string | null;
}

const DEFAULT_ACCEPT = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

type Props =
  /** Multi-image field bound to a URL list (product form). */
  | { value: string[]; onChange: (urls: string[]) => void; onUploaded?: never }
  /** Single-image field — caller keeps its own state (categories, brands…). */
  | { onUploaded: (url: string) => void; value?: never; onChange?: never };

export function MediaUploader(props: Props) {
  const multi = 'value' in props && Array.isArray(props.value);
  const value = multi ? (props.value as string[]) : [];

  const inputRef = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState<MediaConfig | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [error, setError] = useState<string | null>(null);
  const sessionUrls = useRef<Set<string>>(new Set()); // uploaded now → safe to delete on removal
  const seen = useRef<Set<string>>(new Set()); // name+size fingerprints already handled
  // Latest props/value without re-creating callbacks on every parent render.
  const stateRef = useRef({ multi, value, props });
  stateRef.current = { multi, value, props };

  useEffect(() => {
    apiFetch<MediaConfig>('/admin/media/config').then(setCfg).catch(() => setCfg(null));
  }, []);

  const accept = cfg?.acceptedTypes?.length ? cfg.acceptedTypes : DEFAULT_ACCEPT;
  const maxMb = cfg?.maxMb ?? 15;

  const emit = useCallback((url: string) => {
    sessionUrls.current.add(url);
    const s = stateRef.current;
    if (s.multi) {
      const cur = s.value;
      const next = cur.includes(url) ? cur : [...cur, url];
      (s.props as { onChange: (u: string[]) => void }).onChange(next);
    } else {
      (s.props as { onUploaded: (u: string) => void }).onUploaded(url);
    }
  }, []);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      setError(null);
      const files = stateRef.current.multi
        ? Array.from(fileList)
        : fileList.length
          ? [fileList[0]!]
          : [];

      for (const file of files) {
        const fp = `${file.name}::${file.size}`;
        if (stateRef.current.multi && seen.current.has(fp)) continue; // duplicate select — skip
        if (!accept.includes(file.type)) {
          setError(`"${file.name}" — ${file.type || 'unknown type'} is not allowed.`);
          continue;
        }
        if (file.size > maxMb * 1024 * 1024) {
          setError(`"${file.name}" is larger than ${maxMb} MB.`);
          continue;
        }
        seen.current.add(fp);

        const id = globalThis.crypto.randomUUID();
        const preview = URL.createObjectURL(file);
        setPending((p) => [...p, { id, name: file.name, preview, pct: 0, error: null }]);

        try {
          const { url } = await apiUpload<{ url: string }>('/admin/media/upload', file, {
            onProgress: (pct) => setPending((p) => p.map((x) => (x.id === id ? { ...x, pct } : x))),
          });
          emit(url);
          setPending((p) => {
            const item = p.find((x) => x.id === id);
            if (item) URL.revokeObjectURL(item.preview);
            return p.filter((x) => x.id !== id);
          });
        } catch (e) {
          seen.current.delete(fp);
          setPending((p) =>
            p.map((x) => (x.id === id ? { ...x, error: (e as Error).message, pct: 100 } : x)),
          );
        }
      }
      if (inputRef.current) inputRef.current.value = '';
    },
    [accept, emit, maxMb],
  );

  const remove = useCallback((url: string) => {
    const s = stateRef.current;
    if (s.multi) {
      (s.props as { onChange: (u: string[]) => void }).onChange(s.value.filter((u) => u !== url));
    }
    if (sessionUrls.current.has(url)) {
      sessionUrls.current.delete(url);
      void apiDelete('/admin/media', { url }).catch(() => undefined); // best effort
    }
  }, []);

  const busy = pending.some((p) => !p.error);
  const acceptAttr = cfg?.allowVideo
    ? 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
    : 'image/jpeg,image/png,image/webp';

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="rounded-md border border-dashed border-[var(--color-line)] px-4 py-3 text-sm text-[var(--color-muted)] hover:border-[var(--color-brand)] disabled:opacity-50"
      >
        {busy ? 'Uploading…' : cfg?.allowVideo ? 'Upload images / video' : 'Upload images'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={acceptAttr}
        multiple={multi}
        hidden
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {cfg && !cfg.persistent && (
        <p className="mt-1 text-xs text-[var(--color-bad)]">
          Storage is not on the cloud — uploads will be lost on the next deploy.
        </p>
      )}
      {cfg && cfg.persistent && cfg.endpointConfigured === false && (
        <p className="mt-1 text-xs text-[var(--color-bad)]">
          Image storage is misconfigured on the server (missing storage endpoint) — uploads will fail.
          Ask an admin to set <code>S3_ENDPOINT</code>.
        </p>
      )}
      {error && <p className="mt-1 text-xs text-[var(--color-bad)]">{error}</p>}

      {(multi ? value.length > 0 || pending.length > 0 : pending.length > 0) && (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {multi &&
            value.map((url) => (
              <figure
                key={url}
                className="group relative aspect-square overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-canvas)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin thumbnail, arbitrary hosts */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => remove(url)}
                  title="Remove image"
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white opacity-0 transition group-hover:opacity-100"
                >
                  ✕
                </button>
              </figure>
            ))}
          {pending.map((p) => (
            <figure
              key={p.id}
              className="relative aspect-square overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-canvas)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
              <figcaption className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[10px] text-white">
                {p.error ? 'Failed' : `${p.pct}%`}
              </figcaption>
              {!p.error ? (
                <div className="absolute inset-x-1 bottom-4 h-1 overflow-hidden rounded bg-white/30">
                  <div className="h-full bg-white transition-[width]" style={{ width: `${p.pct}%` }} />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(p.preview);
                    setPending((list) => list.filter((x) => x.id !== p.id));
                  }}
                  className="absolute right-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-xs text-white"
                >
                  ✕
                </button>
              )}
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
