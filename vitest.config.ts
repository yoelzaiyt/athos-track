import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // `src/**` entrou junto com src/lib/csvExport.test.ts: sem isso o vitest
    // só enxerga os testes de server/ e os testes de front nunca rodam.
    include: ['server/**/*.test.ts', 'src/**/*.test.ts'],
  },
});
