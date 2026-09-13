import { defineConfig } from 'vitest/config';

// Dois grupos, porque a suíte é mista: a maior parte é unit test puro, mas 4
// arquivos são teste de integração REAL contra Postgres (sobem a API numa
// porta efêmera, fazem login de verdade, gravam e apagam linhas). Esses só
// rodam com DATABASE_URL/DIRECT_URL apontando pra um banco descartável já
// migrado — ver .github/workflows/ci.yml, job `test-db`.
//
//   npm test           → só os unitários (padrão seguro, sem banco)
//   npm run test:unit  → idem
//   npm run test:db    → precisa de Postgres migrado E DESCARTÁVEL
//   npm run test:all   → os dois
//
// `npm test` deliberadamente NÃO inclui o grupo `db`: esses testes gravam e
// apagam linhas (tenants RBACTEST-*/CONCTEST-*) no banco que DATABASE_URL
// apontar, sem pedir confirmação. Com um .env apontando pra produção, um
// `npm test` distraído escreveria em produção. Rodar contra banco real agora
// exige dizer isso explicitamente (test:db/test:all).
const DB_TESTS = [
  'server/api/rbac.test.ts',
  'server/api/password-reset.test.ts',
  'server/api/realtime.test.ts',
  'server/api/tag-classification.test.ts',
  'server/api/apiKeys.test.ts',
  'server/integrations/brgps/db.concurrency.test.ts',
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['server/**/*.test.ts', 'src/**/*.test.ts'],
          exclude: ['**/node_modules/**', ...DB_TESTS],
        },
      },
      {
        test: {
          name: 'db',
          environment: 'node',
          include: DB_TESTS,
          // Integração real contra um banco compartilhado: em paralelo esses
          // arquivos disputam as mesmas linhas (os tenants ZAFFARI/SAO-JOAO)
          // e o cleanup de um derruba o setup do outro. singleFork = os 5
          // rodam em sequência, num processo só (`fileParallelism` não é
          // aceito em config de project, só na raiz).
          pool: 'forks',
          poolOptions: { forks: { singleFork: true } },
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
