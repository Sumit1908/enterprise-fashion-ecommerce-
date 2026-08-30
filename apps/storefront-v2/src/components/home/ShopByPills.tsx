'use client';

import { useState } from 'react';
import { SHOP_BY } from '@/lib/data/categories';

export function ShopByPills() {
  const [active, setActive] = useState('bestseller');

  return (
    <section className="container-page py-8 lg:py-10">
      <div className="hide-scrollbar -mx-1 flex items-center justify-start gap-2.5 overflow-x-auto px-1 md:justify-center">
        {SHOP_BY.map((s) => (
          <a
            key={s.value}
            href="#bestsellers"
            onClick={() => setActive(s.value)}
            className={`pill text-[12px] ${active === s.value ? 'pill--active' : ''}`}
          >
            {s.label}
          </a>
        ))}
      </div>
    </section>
  );
}
