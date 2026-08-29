import { ComingSoon } from '@/components/coming-soon';

export default function Page() {
  return (
    <ComingSoon
      title="Banners & Pages"
      phase="Phase 3"
      items={[
        'Hero / strip / promo-bar banner scheduling with countdowns',
        'Homepage section ordering and toggles',
        'Block-based landing page builder (campaigns, brand pages, collections)',
        'Blog posts, lookbooks and navigation menus',
      ]}
    />
  );
}
