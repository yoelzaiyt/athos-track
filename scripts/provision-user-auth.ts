// Cria a credencial de login (Supabase Auth) para um usuário já cadastrado
// no CRUD de Usuários (tabela user_profiles) — generalização de
// provision-demo-auth-user.ts para qualquer e-mail, não só a conta demo.
//
// Por quê SQL direto via DIRECT_URL em vez da Admin API (auth.admin.createUser):
// evita precisar da service_role key (que este projeto não guarda em lugar
// nenhum, propositalmente — nunca deve ficar em variável de ambiente do
// frontend nem seria seguro colocar num script rodado localmente sem os
// devidos cuidados). DIRECT_URL já é a credencial de Postgres usada nas
// migrations, então reaproveita o mesmo acesso.
//
// Fluxo: o usuário é cadastrado primeiro na tela (Usuários e Matriz de
// Permissões), que grava nome/e-mail/role em user_profiles. Depois, alguém
// com acesso ao servidor/repositório roda este script para liberar o login.
// O auth_user_id da linha em user_profiles é atualizado para vincular o
// perfil à conta de autenticação recém-criada.
//
// Idempotente: não faz nada se o e-mail já existir em auth.users.
//
// Uso: npx tsx scripts/provision-user-auth.ts <email> <senha>

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

const env = Object.fromEntries(
  readFileSync(path.join(projectDir, '.env'), 'utf-8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      let v = l.slice(i + 1);
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return [l.slice(0, i), v];
    })
);

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Uso: npx tsx scripts/provision-user-auth.ts <email> <senha>');
  process.exitCode = 1;
} else if (password.length < 6) {
  console.error('A senha precisa ter pelo menos 6 caracteres (mínimo exigido pelo Supabase Auth).');
  process.exitCode = 1;
} else {
  main(email, password).catch((err) => {
    console.error('FALHOU:', err.message);
    process.exitCode = 1;
  });
}

async function main(email: string, password: string) {
  const client = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected.');

  try {
    const profile = await client.query('select id, auth_user_id from user_profiles where email = $1', [email]);
    if (profile.rows.length === 0) {
      console.error(
        `Nenhum perfil encontrado em user_profiles para "${email}". Cadastre o usuário na tela Usuários antes de liberar o login.`
      );
      process.exitCode = 1;
      return;
    }
    const profileRow = profile.rows[0];

    const existing = await client.query('select id from auth.users where email = $1', [email]);
    if (existing.rows.length > 0) {
      console.log('Conta de login já existe:', existing.rows[0].id, '- nada a fazer.');
      return;
    }

    await client.query('begin');

    const userRes = await client.query(
      `insert into auth.users (
         instance_id, id, aud, role, email, encrypted_password,
         email_confirmed_at, created_at, updated_at,
         raw_app_meta_data, raw_user_meta_data,
         confirmation_token, recovery_token, email_change_token_new, email_change,
         is_sso_user, is_anonymous
       ) values (
         '00000000-0000-0000-0000-000000000000',
         gen_random_uuid(),
         'authenticated',
         'authenticated',
         $1,
         crypt($2, gen_salt('bf')),
         now(),
         now(),
         now(),
         '{"provider":"email","providers":["email"]}',
         '{}',
         '', '', '', '',
         false, false
       ) returning id`,
      [email, password]
    );
    const userId = userRes.rows[0].id;

    await client.query(
      `insert into auth.identities (
         id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
       ) values (
         gen_random_uuid(), $1::uuid, $1::text,
         jsonb_build_object('sub', $1::text, 'email', $2::text),
         'email', now(), now(), now()
       )`,
      [userId, email]
    );

    await client.query('update user_profiles set auth_user_id = $1 where id = $2', [userId, profileRow.id]);

    await client.query('commit');
    console.log('Conta de login criada:', userId, `(${email}) e vinculada ao perfil ${profileRow.id}.`);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}
