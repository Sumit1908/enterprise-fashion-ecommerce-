'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { Button, Card, Checkbox, Field, Input, Textarea } from '@/components/form';
import { MediaUploader } from '@/components/media-uploader';

interface Hero {
  id?: string;
  title?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  imageMobileUrl?: string | null;
  isActive?: boolean;
}
interface Section {
  id: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  position: number;
}
interface Testimonial {
  id: string;
  authorName: string;
  authorRole: string | null;
  quote: string;
  rating: number;
  isActive: boolean;
  position: number;
}

export default function HomepagePage() {
  const [hero, setHero] = useState<Hero | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<{ hero: Hero | null; sections: Section[]; testimonials: Testimonial[] }>('/admin/homepage')
      .then((d) => {
        setHero(d.hero ?? {});
        setSections(d.sections);
        setTestimonials(d.testimonials);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!hero) return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;

  return (
    <>
      <PageHeader title="Homepage" subtitle="Hero banner, section titles/visibility and customer testimonials. Changes are live." />
      <div className="space-y-6">
        <HeroEditor hero={hero} onSaved={load} />
        <SectionsEditor sections={sections} onSaved={load} />
        <TestimonialsEditor rows={testimonials} onSaved={load} />
      </div>
    </>
  );
}

function HeroEditor({ hero, onSaved }: { hero: Hero; onSaved: () => void }) {
  const [v, setV] = useState<Hero>(hero);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof Hero>(k: K, val: Hero[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await apiFetch('/admin/homepage/hero', {
        method: 'PATCH',
        body: JSON.stringify({
          title: v.title ?? '',
          headline: v.headline ?? '',
          subheadline: v.subheadline ?? '',
          ctaLabel: v.ctaLabel ?? '',
          ctaUrl: v.ctaUrl ?? '',
          imageUrl: v.imageUrl ?? '',
          imageMobileUrl: v.imageMobileUrl ?? '',
          isActive: v.isActive ?? true,
        }),
      });
      setMsg('Saved');
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Hero banner">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eyebrow / label" hint="Small text above the headline">
          <Input value={v.title ?? ''} onChange={(e) => set('title', e.target.value)} />
        </Field>
        <Field label="CTA button label">
          <Input value={v.ctaLabel ?? ''} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Shop New In" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Headline">
            <Input value={v.headline ?? ''} onChange={(e) => set('headline', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Subheadline">
            <Input value={v.subheadline ?? ''} onChange={(e) => set('subheadline', e.target.value)} />
          </Field>
        </div>
        <Field label="CTA link" hint="e.g. /collections/new-arrivals">
          <Input value={v.ctaUrl ?? ''} onChange={(e) => set('ctaUrl', e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Checkbox label="Show hero" checked={v.isActive ?? true} onChange={(c) => set('isActive', c)} />
        </div>
        <div>
          <Field label="Desktop image URL">
            <Input value={v.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <div className="mt-2 flex items-center gap-3">
            <MediaUploader onUploaded={(u) => set('imageUrl', u)} />
            {v.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.imageUrl} alt="" className="h-16 w-28 rounded border border-[var(--color-line)] object-cover" />
            )}
          </div>
        </div>
        <div>
          <Field label="Mobile image URL (optional)">
            <Input value={v.imageMobileUrl ?? ''} onChange={(e) => set('imageMobileUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <div className="mt-2 flex items-center gap-3">
            <MediaUploader onUploaded={(u) => set('imageMobileUrl', u)} />
            {v.imageMobileUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.imageMobileUrl} alt="" className="h-16 w-16 rounded border border-[var(--color-line)] object-cover" />
            )}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save hero'}</Button>
        {msg && <span className="text-xs text-[var(--color-muted)]">{msg}</span>}
      </div>
    </Card>
  );
}

function SectionsEditor({ sections, onSaved }: { sections: Section[]; onSaved: () => void }) {
  return (
    <Card title="Homepage sections">
      <p className="mb-3 text-xs text-[var(--color-muted)]">
        Edit the title/subtitle shown above each block and toggle it on or off. Which products appear
        in “New Arrivals” / “Best Sellers” etc. is controlled by the merchandising flags on each
        product (Products → edit → Merchandising).
      </p>
      <div className="space-y-2">
        {sections.map((s) => (
          <SectionRow key={s.id} section={s} onSaved={onSaved} />
        ))}
      </div>
    </Card>
  );
}

function SectionRow({ section, onSaved }: { section: Section; onSaved: () => void }) {
  const [title, setTitle] = useState(section.title ?? '');
  const [subtitle, setSubtitle] = useState(section.subtitle ?? '');
  const [active, setActive] = useState(section.isActive);
  const [saving, setSaving] = useState(false);

  async function save(next: Partial<{ isActive: boolean }> = {}) {
    setSaving(true);
    try {
      await apiFetch(`/admin/homepage/sections/${section.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, subtitle, isActive: next.isActive ?? active }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid items-center gap-2 border-t border-[var(--color-line)] py-2 text-sm sm:grid-cols-[110px_1fr_1fr_auto_auto]">
      <span className="text-xs uppercase text-[var(--color-muted)]">{section.type}</span>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
      <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Subtitle" />
      <button
        onClick={() => {
          setActive(!active);
          void save({ isActive: !active });
        }}
        className={`text-xs ${active ? 'text-[var(--color-good)]' : 'text-[var(--color-muted)]'}`}
      >
        {active ? 'Visible' : 'Hidden'}
      </button>
      <Button variant="ghost" onClick={() => save()} disabled={saving}>
        Save
      </Button>
    </div>
  );
}

function TestimonialsEditor({ rows, onSaved }: { rows: Testimonial[]; onSaved: () => void }) {
  const [name, setName] = useState('');
  const [quote, setQuote] = useState('');

  async function add() {
    if (!name.trim() || !quote.trim()) return;
    await apiFetch('/admin/homepage/testimonials', {
      method: 'POST',
      body: JSON.stringify({ authorName: name, quote, position: rows.length }),
    });
    setName('');
    setQuote('');
    onSaved();
  }

  return (
    <Card title="Customer testimonials">
      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
        <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input placeholder="Quote" value={quote} onChange={(e) => setQuote(e.target.value)} />
        <Button onClick={add}>Add</Button>
      </div>
      <div className="space-y-2">
        {rows.map((t) => (
          <TestimonialRow key={t.id} row={t} onSaved={onSaved} />
        ))}
      </div>
    </Card>
  );
}

function TestimonialRow({ row, onSaved }: { row: Testimonial; onSaved: () => void }) {
  const [name, setName] = useState(row.authorName);
  const [quote, setQuote] = useState(row.quote);
  const [rating, setRating] = useState(String(row.rating));

  async function save() {
    await apiFetch(`/admin/homepage/testimonials/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ authorName: name, quote, rating: Number(rating) }),
    });
    onSaved();
  }
  async function toggle() {
    await apiFetch(`/admin/homepage/testimonials/${row.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !row.isActive }),
    });
    onSaved();
  }
  async function del() {
    if (!confirm('Delete this testimonial?')) return;
    await apiFetch(`/admin/homepage/testimonials/${row.id}`, { method: 'DELETE' });
    onSaved();
  }

  return (
    <div className="grid items-center gap-2 border-t border-[var(--color-line)] py-2 text-sm sm:grid-cols-[1fr_2.5fr_60px_auto_auto_auto]">
      <Input value={name} onChange={(e) => setName(e.target.value)} />
      <Textarea value={quote} onChange={(e) => setQuote(e.target.value)} className="min-h-[38px]" />
      <Input type="number" value={rating} onChange={(e) => setRating(e.target.value)} min={1} max={5} />
      <Button variant="ghost" onClick={save}>Save</Button>
      <button onClick={toggle} className={`text-xs ${row.isActive ? 'text-[var(--color-good)]' : 'text-[var(--color-muted)]'}`}>
        {row.isActive ? 'Visible' : 'Hidden'}
      </button>
      <button onClick={del} className="text-xs text-[var(--color-bad)]">Delete</button>
    </div>
  );
}
