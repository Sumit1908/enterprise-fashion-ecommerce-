import { ComingSoon } from '@/components/coming-soon';

export default function Page() {
  return (
    <ComingSoon
      title="Settings"
      phase="Phase 4 (Super Admin)"
      items={[
        'Payment, shipping, tax, email, SMS and WhatsApp configuration',
        'Staff accounts, roles and role-based permissions',
        'Integration credentials (Razorpay, Stripe, Shiprocket, …)',
        'Audit log viewer',
        'Store profile, SEO defaults and feature flags',
      ]}
    />
  );
}
