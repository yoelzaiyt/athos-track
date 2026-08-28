-- SEC-008/SEC-009 (ver SECURITY-GATE-REPORT.md): até aqui, um JWT válido por
-- 7 dias não tinha como ser revogado — nem "logout" (só limpa o
-- localStorage), nem troca de senha, nem desligar alguém invalidavam um
-- token já emitido. E não existia nenhuma forma de desativar uma conta sem
-- deletá-la inteira.
--
-- is_active: liga/desliga o acesso de alguém sem apagar o perfil (mantém
-- autoria histórica). Checado em toda requisição autenticada.
--
-- session_version: contador que entra no JWT no momento do login. Toda
-- requisição autenticada compara o valor do token com o valor atual no
-- banco — se não bater, o token é tratado como revogado, mesmo ainda dentro
-- da validade de 7 dias. Incrementar essa coluna = "deslogar de todo lugar"
-- pra essa pessoa (usado por /auth/logout, pela troca de senha via
-- scripts/provision-user-password.ts, e disponível pra um ATHOS_ADMIN
-- forçar via PATCH /rest/user_profiles).
alter table user_profiles
  add column if not exists is_active boolean not null default true,
  add column if not exists session_version integer not null default 1;
