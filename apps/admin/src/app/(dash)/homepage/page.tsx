'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/client';
import { PageHeader } from '@/components/shell';
import { Button, Card, Checkbox, Field, Input, Textarea } from '@/components/form';
import { MediaUploader } from '@/components/media-uploader';

interface HeroSlide {
  id: string;
  title?: string | null;
  headline?: string | null;
  subheadline?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  imageUrl?: string | null;
  imageMobileUrl?: string | null;
  isActive: boolean;
  position: number;
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
  const [heroSlides, setHeroSlides] = useState<HeroSlide[] | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch<{ heroSlides: HeroSlide[]; sections: Section[]; testimonials: Testimonial[] }>('/admin/homepage')
      .then((d) => {
        setHeroSlides(d.heroSlides ?? []);
        setSections(d.sections);
        setTestimonials(d.testimonials);
      })
      .catch((e) => setError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  if (error) return <p className="text-sm text-[var(--color-bad)]">{error}</p>;
  if (!heroSlides) return <p className="text-sm text-[var(--color-muted)]">Loading…</p>;

  return (
    <>
      <PageHeader title="Homepage" subtitle="Hero slider, section titles/visibility and customer testimonials. Changes are live." />
      <div className="space-y-6">
        <HeroSlidesEditor slides={heroSlides} onSaved={load} />
        <SectionsEditor sections={sections} onSaved={load} />
        <TestimonialsEditor rows={testimonials} onSaved={load} />
      </div>
    </>
  );
}

function HeroSlidesEditor({ slides, onSaved }: { slides: HeroSlide[]; onSaved: () => void }) {
  const [adding, setAdding] = useState(false);

  async function addSlide() {
    setAdding(true);
    try {
      await apiFetch('/admin/homepage/hero', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New',
          headline: 'New headline',
          ctaLabel: 'Shop now',
          ctaUrl: '/shop',
          isActive: false,
        }),
      });
      onSaved();
    } finally {
      setAdding(false);
    }
  }

  return (
    <Card title="Hero slider">
      <p className="mb-4 text-xs text-[var(--color-muted)]">
        Slides play in order, top to bottom. Each slide has a separate desktop and mobile image —
        desktop shows above 768px, mobile below. Turn a slide off to hide it without deleting it.
        The slider autoplays, with arrows and dots, only when 2+ slides are active.
      </p>
      <div className="space-y-4">
        {slides.length === 0 && (
          <p className="rounded-md border border-dashed border-[var(--color-line)] p-6 text-center text-sm text-[var(--color-muted)]">
            No hero slides yet. Add one below.
          </p>
        )}
        {slides.map((s, i) => (
          <HeroSlideRow
            key={s.id}
            slide={s}
            first={i === 0}
            last={i === slides.length - 1}
            onSaved={onSaved}
          />
        ))}
      </div>
      <div className="mt-4">
        <Button onClick={addSlide} disabled={adding}>
          {adding ? 'Adding…' : '+ Add slide'}
        </Button>
      </div>
    </Card>
  );
}

function HeroSlideRow({
  slide,
  first,
  last,
  onSaved,
}: {
  slide: HeroSlide;
  first: boolean;
  last: boolean;
  onSaved: () => void;
}) {
  const [v, setV] = useState<HeroSlide>(slide);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = <K extends keyof HeroSlide>(k: K, val: HeroSlide[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save(extra: Partial<HeroSlide> = {}) {
    setSaving(true);
    setMsg(null);
    const next = { ...v, ...extra };
    try {
      await apiFetch(`/admin/homepage/hero/${slide.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: next.title ?? '',
          headline: next.headline ?? '',
          subheadline: next.subheadline ?? '',
          ctaLabel: next.ctaLabel ?? '',
          ctaUrl: next.ctaUrl ?? '',
          imageUrl: next.imageUrl ?? '',
          imageMobileUrl: next.imageMobileUrl ?? '',
          isActive: next.isActive,
        }),
      });
      setV(next);
      setMsg('Saved');
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function move(direction: 'up' | 'down') {
    await apiFetch(`/admin/homepage/hero/${slide.id}/move`, {
      method: 'PATCH',
      body: JSON.stringify({ direction }),
    });
    onSaved();
  }

  async function del() {
    if (!confirm('Delete this hero slide?')) return;
    await apiFetch(`/admin/homepage/hero/${slide.id}`, { method: 'DELETE' });
    onSaved();
  }

  return (
    <div className="rounded-lg border border-[var(--color-line)] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
          Slide {slide.position + 1}
          {!v.isActive && ' · hidden'}
        </span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" onClick={() => move('up')} disabled={first} className="px-2 py-1">↑</Button>
          <Button variant="ghost" onClick={() => move('down')} disabled={last} className="px-2 py-1">↓</Button>
          <Button variant="danger" onClick={del} className="px-2 py-1">Delete</Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Eyebrow / label" hint="Small text above the headline">
          <Input value={v.title ?? ''} onChange={(e) => set('title', e.target.value)} placeholder="e.g. New Season" />
        </Field>
        <Field label="CTA button label">
          <Input value={v.ctaLabel ?? ''} onChange={(e) => set('ctaLabel', e.target.value)} placeholder="Shop now" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Headline">
            <Input value={v.headline ?? ''} onChange={(e) => set('headline', e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Subheadline (optional)">
            <Input value={v.subheadline ?? ''} onChange={(e) => set('subheadline', e.target.value)} />
          </Field>
        </div>
        <Field label="CTA link" hint="e.g. /collections/oxford or /c/men-shirts">
          <Input value={v.ctaUrl ?? ''} onChange={(e) => set('ctaUrl', e.target.value)} />
        </Field>
        <div className="flex items-end">
          <Checkbox label="Slide active" checked={v.isActive} onChange={(c) => save({ isActive: c })} />
        </div>

        <div>
          <Field label="Desktop banner (shown above 768px)">
            <Input value={v.imageUrl ?? ''} onChange={(e) => set('imageUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <div className="mt-2 flex items-center gap-3">
            <MediaUploader onUploaded={(u) => save({ imageUrl: u })} />
            {v.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.imageUrl} alt="" className="h-16 w-28 rounded border border-[var(--color-line)] object-cover" />
            )}
          </div>
        </div>
        <div>
          <Field label="Mobile banner (shown below 768px)">
            <Input value={v.imageMobileUrl ?? ''} onChange={(e) => set('imageMobileUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <div className="mt-2 flex items-center gap-3">
            <MediaUploader onUploaded={(u) => save({ imageMobileUrl: u })} />
            {v.imageMobileUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={v.imageMobileUrl} alt="" className="h-16 w-16 rounded border border-[var(--color-line)] object-cover" />
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button onClick={() => save()} disabled={saving}>{saving ? 'Saving…' : 'Save slide'}</Button>
        {msg && <span className="text-xs text-[var(--color-muted)]">{msg}</span>}
      </div>
    </div>
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
