import { ComingSoon } from '@/components/coming-soon';

export default function Page() {
  return (
    <ComingSoon
      title="Reports"
      phase="Phase 4"
      items={[
        'Revenue, orders, AOV and conversion trends',
        'Product, category and coupon performance',
        'Inventory valuation and low-stock reports',
        'Abandoned cart and marketing attribution',
        'CSV / Excel export',
      ]}
    />
  );
}
