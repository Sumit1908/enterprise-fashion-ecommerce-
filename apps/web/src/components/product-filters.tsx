'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Facets } from '@/lib/api';

const SORTS: [string, string][] = [
  ['latest', 'Newest'],
  ['popular', 'Popular'],
  ['bestselling', 'Best Selling'],
  ['price_asc', 'Price: Low to High'],
  ['price_desc', 'Price: High to Low'],
  ['rating', 'Highest Rated'],
];

type SP = Record<string, string | undefined>;

/** Filter + sort bar for product listings. Reuses the site's pill styling; every
 *  change updates the URL and the server page re-fetches. */
export function ProductFilters({
  basePath,
  sp,
  facets,
  total,
}: {
  basePath: string;
  sp: SP;
  facets: Facets;
  total: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const csv = (key: string) => (sp[key] ? sp[key]!.split(',').filter(Boolean) : []);
  const activeSizes = csv('size');
  const activeColors = csv('color');
  const activeSubs = csv('sub');

  function apply(next: SP) {
    const params = new URLSearchParams();
    const merged = { ...sp, ...next };
    for (const [k, v] of Object.entries(merged)) {
      if (v != null && v !== '' && k !== 'page') params.set(k, v);
    }
    const q = params.toString();
    router.push(q ? `${basePath}?${q}` : basePath, { scroll: false });
  }

  function toggleCsv(key: string, value: string) {
    const cur = csv(key);
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    apply({ [key]: next.join(',') || undefined });
  }

  const priceBands = buildPriceBands(facets.price.min, facets.price.max);
  const activePrice =
    sp.minPrice || sp.maxPrice ? `${sp.minPrice ?? 0}-${sp.maxPrice ?? ''}` : '';

  const activeCount =
    activeSizes.length +
    activeColors.length +
    activeSubs.length +
    (activePrice ? 1 : 0) +
    (sp.inStock ? 1 : 0) +
    (sp.brand ? sp.brand.split(',').filter(Boolean).length : 0);

  const hasFilters =
    facets.subcategories.length > 0 ||
    facets.sizes.length > 0 ||
    facets.colors.length > 0 ||
    facets.brands.length > 1;

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-[var(--color-ink-soft)]">{total} products</p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-sand)] px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] transition-colors hover:border-[var(--color-ink)]"
            >
              Filters
              {activeCount > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-ink)] px-1 text-[10px] text-white">
                  {activeCount}
                </span>
              )}
              <span className="text-[var(--color-ink-soft)]">{open ? '−' : '+'}</span>
            </button>
          )}
        </div>

        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-ink-soft)]">Sort</span>
          <select
            value={sp.sort ?? 'latest'}
            onChange={(e) => apply({ sort: e.target.value === 'latest' ? undefined : e.target.value })}
            className="rounded-full border border-[var(--color-sand)] bg-white px-3.5 py-1.5 text-sm focus:border-[var(--color-ink)] focus:outline-none"
          >
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {activeSubs.map((s) => (
            <Chip key={`sub-${s}`} label={facets.subcategories.find((x) => x.slug === s)?.name ?? s} onClear={() => toggleCsv('sub', s)} />
          ))}
          {activeSizes.map((s) => (
            <Chip key={`size-${s}`} label={`Size ${s}`} onClear={() => toggleCsv('size', s)} />
          ))}
          {activeColors.map((c) => (
            <Chip key={`color-${c}`} label={c} onClear={() => toggleCsv('color', c)} />
          ))}
          {activePrice && (
            <Chip
              label={priceLabel(sp.minPrice, sp.maxPrice)}
              onClear={() => apply({ minPrice: undefined, maxPrice: undefined })}
            />
          )}
          {sp.inStock && <Chip label="In stock" onClear={() => apply({ inStock: undefined })} />}
          {(sp.brand ? sp.brand.split(',').filter(Boolean) : []).map((b) => (
            <Chip key={`brand-${b}`} label={facets.brands.find((x) => x.slug === b)?.name ?? b} onClear={() => toggleCsv('brand', b)} />
          ))}
          <button
            type="button"
            onClick={() =>
              apply({ size: undefined, color: undefined, sub: undefined, minPrice: undefined, maxPrice: undefined, inStock: undefined, brand: undefined })
            }
            className="text-xs font-medium text-[var(--color-ink-soft)] underline hover:text-[var(--color-ink)]"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Filter panel */}
      {open && hasFilters && (
        <div className="mt-4 grid gap-6 border-y border-[var(--color-sand)] py-6 sm:grid-cols-2 lg:grid-cols-4">
          {facets.subcategories.length > 0 && (
            <Group title="Category">
              {facets.subcategories.map((s) => (
                <PillToggle key={s.slug} active={activeSubs.includes(s.slug)} onClick={() => toggleCsv('sub', s.slug)}>
                  {s.name}
                </PillToggle>
              ))}
            </Group>
          )}

          {facets.sizes.length > 0 && (
            <Group title="Size">
              {facets.sizes.map((s) => (
                <PillToggle key={s} active={activeSizes.includes(s)} onClick={() => toggleCsv('size', s)}>
                  {s}
                </PillToggle>
              ))}
            </Group>
          )}

          {facets.colors.length > 0 && (
            <Group title="Colour">
              {facets.colors.map((c) => (
                <PillToggle key={c.name} active={activeColors.includes(c.name)} onClick={() => toggleCsv('color', c.name)}>
                  <span
                    className="h-3 w-3 rounded-full border border-black/15"
                    style={{ backgroundColor: c.hex ?? '#ccc' }}
                  />
                  {c.name}
                </PillToggle>
              ))}
            </Group>
          )}

          <Group title="Price">
            {priceBands.map((b) => {
              const key = `${b.min ?? 0}-${b.max ?? ''}`;
              const active = activePrice === key;
              return (
                <PillToggle
                  key={b.label}
                  active={active}
                  onClick={() =>
                    apply({
                      minPrice: active || b.min == null ? undefined : String(b.min),
                      maxPrice: active || b.max == null ? undefined : String(b.max),
                    })
                  }
                >
                  {b.label}
                </PillToggle>
              );
            })}
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(sp.inStock)}
                onChange={(e) => apply({ inStock: e.target.checked ? 'true' : undefined })}
                className="h-4 w-4 accent-[var(--color-ink)]"
              />
              In stock only
            </label>
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-3">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function PillToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
        active
          ? 'border-[var(--color-ink)] bg-[var(--color-ink)] text-white'
          : 'border-[var(--color-sand)] hover:border-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-bone)] px-3 py-1 text-xs">
      {label}
      <button type="button" onClick={onClear} aria-label={`Remove ${label}`} className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]">
        &times;
      </button>
    </span>
  );
}

function buildPriceBands(min: number, max: number) {
  if (max <= 0 || max <= min) return [] as { label: string; min: number | null; max: number | null }[];
  const bands: { label: string; min: number | null; max: number | null }[] = [];
  const stops = [1000, 2000, 3000, 5000].filter((s) => s > min && s < max);
  let prev = 0;
  for (const s of stops) {
    bands.push({ label: prev === 0 ? `Under ₹${s.toLocaleString('en-IN')}` : `₹${prev.toLocaleString('en-IN')} – ₹${s.toLocaleString('en-IN')}`, min: prev || null, max: s });
    prev = s;
  }
  bands.push({ label: `₹${prev.toLocaleString('en-IN')}+`, min: prev || null, max: null });
  return bands;
}

function priceLabel(min?: string, max?: string) {
  const lo = min ? `₹${Number(min).toLocaleString('en-IN')}` : '';
  const hi = max ? `₹${Number(max).toLocaleString('en-IN')}` : '';
  if (lo && hi) return `${lo} – ${hi}`;
  if (hi) return `Under ${hi}`;
  return `${lo}+`;
}
