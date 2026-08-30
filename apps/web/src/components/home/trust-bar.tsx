const ITEMS: { title: string; sub: string; icon: React.ReactNode }[] = [
  {
    title: 'Complimentary Shipping',
    sub: 'On every order over ₹999',
    icon: (
      <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
    ),
  },
  {
    title: 'Easy 7-Day Returns',
    sub: 'Hassle-free exchanges',
    icon: <path d="M4 9a8 8 0 0 1 14-4M4 5v4h4M20 15a8 8 0 0 1-14 4M20 19v-4h-4" />,
  },
  {
    title: 'Secure Checkout',
    sub: 'SSL-encrypted payments',
    icon: <path d="M6 10V8a6 6 0 0 1 12 0v2M5 10h14v10H5zM12 14v3" />,
  },
  {
    title: 'Cash on Delivery',
    sub: 'Available across India',
    icon: <path d="M3 7h18v10H3zM3 11h18M7 15h4" />,
  },
];

export function TrustBar() {
  return (
    <section className="border-y border-[var(--color-sand)] bg-[var(--color-paper)]">
      <div className="container-wide grid grid-cols-2 divide-[var(--color-sand)] md:grid-cols-4 md:divide-x">
        {ITEMS.map((item) => (
          <div key={item.title} className="flex items-center gap-3 px-2 py-5 md:justify-center md:py-7">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 shrink-0 text-[var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {item.icon}
            </svg>
            <div>
              <p className="text-[0.8rem] font-semibold">{item.title}</p>
              <p className="mt-0.5 text-[0.7rem] text-[var(--color-ink-soft)]">{item.sub}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
