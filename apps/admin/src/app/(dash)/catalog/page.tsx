import { ComingSoon } from '@/components/coming-soon';

export default function Page() {
  return (
    <ComingSoon
      title="Categories & Collections"
      phase="Phase 2"
      items={[
        'Drag-and-drop category tree editor',
        'Manual and rule-based (automated) collections',
        'Per-category SEO content blocks and banners',
        'Bulk assign products to collections',
      ]}
    />
  );
}
