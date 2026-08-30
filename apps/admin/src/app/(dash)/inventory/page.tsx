'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { Button, Card, Input, Select } from '@/components/form';

interface Level {
  id: string;
  onHand: number;
  reserved: number;
  available: number;
  lowStockThreshold: number;
  updatedAt: string;
  warehouse: { id: string; name: string; code: string };
  variantId: string;
  sku: string;
  variantLabel: string;
  product: { id: string; name: string; slug: string };
}
interface Movement {
  id: string;
  type: string;
  quantity: number;
  reason: string | null;
  createdAt: string;
  variant: { sku: string; product: { name: string } };
}

export default function InventoryPage() {
  const [summary, setSummary] = useState<{ outOfStock: number; low: number; tracked: number }>();
  const [rows, setRows] = useState<Level[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');
  const [q, setQ] = useState('');
  const [movements, setMovements] = useState<Movement[]>([]);
  const [editing, setEditing] = useState<Level | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ filter, pageSize: '100' });
    if (q) params.set('q', q);
    apiFetch<{ items: Level[]; total: number }>(`/admin/inventory?${params}`)
      .then((d) => {
        setRows(d.items);
        setTotal(d.total);
      })
      .catch((e) => setError((e as Error).message));
    apiFetch<{ outOfStock: number; low: number; tracked: number }>('/admin/inventory/summary')
      .then(setSummary)
      .catch(() => undefined);
    apiFetch<{ items: Movement[] }>('/admin/inventory/movements?pageSize=15')
      .then((d) => setMovements(d.items))
      .catch(() => undefined);
  }, [filter, q]);

  useEffect(load, [load]);

  return (
    <>
      <PageHeader title="Inventory" subtitle={`${total} stock records`} />

      {summary && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          <Stat label="Tracked variants" value={summary.tracked} />
          <Stat label="Low stock" value={summary.low} tone={summary.low ? 'warn' : undefined} />
          <Stat
            label="Out of stock"
            value={summary.outOfStock}
            tone={summary.outOfStock ? 'bad' : undefined}
          />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            <Input
              placeholder="Search SKU or product"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
              <option value="all">All</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
          </div>

          {error && <p className="mb-3 text-sm text-[var(--color-bad)]">{error}</p>}

          <div className="overflow-x-auto rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-line)] text-left text-xs uppercase text-[var(--color-muted)]">
                <tr>
                  <th className="px-4 py-3">SKU / Product</th>
                  <th className="px-4 py-3">On hand</th>
                  <th className="px-4 py-3">Reserved</th>
                  <th className="px-4 py-3">Available</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const low = r.onHand > 0 && r.onHand <= r.lowStockThreshold;
                  const out = r.onHand <= 0;
                  return (
                    <tr key={r.id} className="border-b border-[var(--color-line)] last:border-0">
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.sku}</p>
                        <p className="text-xs text-[var(--color-muted)]">
                          {r.product.name}
                          {r.variantLabel ? ` · ${r.variantLabel}` : ''}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            out
                              ? 'font-semibold text-[var(--color-bad)]'
                              : low
                                ? 'font-semibold text-[var(--color-warn)]'
                                : ''
                          }
                        >
                          {r.onHand}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--color-muted)]">{r.reserved}</td>
                      <td className="px-4 py-3">{r.available}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setEditing(r)}
                          className="text-xs font-medium text-[var(--color-brand)]"
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <Card title="Recent stock movements">
          <ul className="space-y-2 text-sm">
            {movements.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-2">
                <span>
                  <span className="font-medium">{m.variant.sku}</span>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {m.type}
                    {m.reason ? ` · ${m.reason}` : ''}
                  </span>
                </span>
                <span
                  className={
                    m.quantity < 0 ? 'text-[var(--color-bad)]' : 'text-[var(--color-good)]'
                  }
                >
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </span>
              </li>
            ))}
            {movements.length === 0 && (
              <li className="text-xs text-[var(--color-muted)]">No movements yet.</li>
            )}
          </ul>
        </Card>
      </div>

      {editing && (
        <AdjustModal
          level={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'warn' | 'bad';
}) {
  const color =
    tone === 'bad'
      ? 'text-[var(--color-bad)]'
      : tone === 'warn'
        ? 'text-[var(--color-warn)]'
        : '';
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <p className="text-xs text-[var(--color-muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function AdjustModal({
  level,
  onClose,
  onDone,
}: {
  level: Level;
  onClose: () => void;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<'set' | 'delta'>('set');
  const [quantity, setQuantity] = useState(String(level.onHand));
  const [type, setType] = useState('ADJUSTMENT');
  const [reason, setReason] = useState('');
  const [threshold, setThreshold] = useState(String(level.lowStockThreshold));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch('/admin/inventory/adjust', {
        method: 'POST',
        body: JSON.stringify({
          variantId: level.variantId,
          warehouseId: level.warehouse.id,
          mode,
          quantity: Number(quantity),
          type,
          reason: reason || undefined,
          lowStockThreshold: Number(threshold),
        }),
      });
      onDone();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-lg bg-[var(--color-surface)] p-6">
        <h2 className="text-sm font-semibold">Adjust stock — {level.sku}</h2>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {level.product.name} · {level.warehouse.name} · currently {level.onHand}
        </p>

        <div className="mt-4 grid gap-3">
          <div className="flex gap-2">
            <Select value={mode} onChange={(e) => setMode(e.target.value as 'set' | 'delta')}>
              <option value="set">Set to</option>
              <option value="delta">Change by</option>
            </Select>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>
          <Select value={type} onChange={(e) => setType(e.target.value)}>
            {['ADJUSTMENT', 'PURCHASE', 'RETURN', 'DAMAGE', 'TRANSFER'].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Reason (optional)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <label className="text-xs text-[var(--color-muted)]">
            Low-stock alert threshold
            <Input
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="mt-1"
            />
          </label>
          {err && <p className="text-xs text-[var(--color-bad)]">{err}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Apply'}
          </Button>
        </div>
      </div>
    </div>
  );
}
