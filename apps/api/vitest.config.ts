import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
  // The codebase uses NodeNext-style `.js` import specifiers that point at `.ts`
  // sources — let Vite resolve them during tests.
  resolve: {
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
});
