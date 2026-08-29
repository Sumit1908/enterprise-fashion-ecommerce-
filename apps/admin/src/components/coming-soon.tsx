import { PageHeader } from '@/components/shell';

export function ComingSoon({ title, phase, items }: { title: string; phase: string; items: string[] }) {
  return (
    <>
      <PageHeader title={title} subtitle={`Scheduled for ${phase} of the build roadmap.`} />
      <div className="rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-8">
        <p className="text-sm text-[var(--color-muted)]">
          The data model and API foundations for this area already exist in the schema. The
          management screens land in {phase}. Planned capabilities:
        </p>
        <ul className="mt-4 list-inside list-disc space-y-1 text-sm">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      </div>
    </>
  );
}
