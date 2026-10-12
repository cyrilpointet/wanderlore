import { defineConfig } from 'vitest/config'

/**
 * Tests run in Node, without a browser and without the backend: they cover
 * the front's own logic, not the framework (project rule). A component is
 * checked by rendering it to static markup (`*.test.tsx`), never in a DOM.
 */
export default defineConfig({
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
})
