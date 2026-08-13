// Cria a conta demo real no Supabase Auth (demo@athostrack.io) direto via SQL
// contra auth.users/auth.identities, usando DIRECT_URL (acesso Postgres, o
// mesmo usado nas migrations) em vez de supabase.auth.signUp com a anon key.
//
// Por quê: signUp pela anon key bate no rate limit de e-mail do Supabase
// rapidinho (poucas tentativas por hora no plano free) e, mesmo com "Confirm
// email" desativado no painel, a conta member fica só disponível depois desse
// limite resetar. Inserir direto via SQL evita a API de auth por completo —
// mesmo efeito de um Admin API createUser com email_confirm:true, só que sem
// precisar da service_role key.
//
// Idempotente: não faz nada se o e-mail já existir em auth.users.
//
// Uso: npx tsx scripts/provision-demo-auth-user.ts

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

const DEMO_EMAIL = 'demo@athostrack.io';
const DEMO_PASSWORD = 'athosdemo123';

async function main() {
  const client = new Client({ connectionString: env.DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected.');

  try {
    const existing = await client.query('select id from auth.users where email = $1', [DEMO_EMAIL]);
    if (existing.rows.length > 0) {
      console.log('Usuário já existe:', existing.rows[0].id, '- nada a fazer.');
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
      [DEMO_EMAIL, DEMO_PASSWORD]
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
      [userId, DEMO_EMAIL]
    );

    await client.query('commit');
    console.log('Usuário criado:', userId, `(${DEMO_EMAIL} / ${DEMO_PASSWORD})`);
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('FALHOU:', err.message);
  process.exitCode = 1;
});
