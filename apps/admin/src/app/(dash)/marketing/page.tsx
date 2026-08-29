import { ComingSoon } from '@/components/coming-soon';

export default function Page() {
  return (
    <ComingSoon
      title="Coupons & Promotions"
      phase="Phase 3"
      items={[
        'Coupon builder: flat, %, free shipping, BOGO, first-order, user-specific',
        'Automatic promotions (festival sales, tiered spend, category offers)',
        'Usage limits, schedules and stacking rules',
        'Redemption analytics',
      ]}
    />
  );
}
