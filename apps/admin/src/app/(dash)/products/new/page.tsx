'use client';

import { PageHeader } from '@/components/shell';
import { ProductForm } from '@/components/product-form';

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="New product" subtitle="Create a product, its variants and stock." />
      <ProductForm />
    </>
  );
}
