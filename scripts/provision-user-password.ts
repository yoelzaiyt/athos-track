// Define/atualiza a senha de login de um usuário já cadastrado em
// user_profiles, pro backend próprio (server/api) — substitui
// provision-user-auth.ts (que dependia do GoTrue/auth.users do Supabase e só
// se aplica enquanto o projeto ainda estiver rodando sobre o Supabase).
//
// Uso: DATABASE_URL=postgresql://... npx tsx scripts/provision-user-password.ts <email> <senha>
// (ou rode com o .env local carregado — ele lê DATABASE_URL de lá se a env var não estiver setada)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');

if (!process.env.DATABASE_URL) {
  try {
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
    if (env.DATABASE_URL) process.env.DATABASE_URL = env.DATABASE_URL;
  } catch {
    // sem .env local — ok, seguimos só com env vars do processo.
  }
}

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error('Uso: npx tsx scripts/provision-user-password.ts <email> <senha>');
  process.exitCode = 1;
} else if (password.length < 6) {
  console.error('A senha precisa ter pelo menos 6 caracteres.');
  process.exitCode = 1;
} else if (!process.env.DATABASE_URL) {
  console.error('Defina DATABASE_URL (connection string do Postgres do Railway).');
  process.exitCode = 1;
} else {
  main(email, password).catch((err) => {
    console.error('FALHOU:', err.message);
    process.exitCode = 1;
  });
}

async function main(email: string, password: string) {
  const connectionString = process.env.DATABASE_URL!;
  const client = new Client({
    connectionString,
    ssl: connectionString.includes('railway') || connectionString.includes('supabase') ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();

  try {
    const profile = await client.query('select id from user_profiles where email = $1', [email]);
    if (profile.rows.length === 0) {
      console.error(
        `Nenhum perfil encontrado em user_profiles para "${email}". Cadastre o usuário na tela Usuários antes de definir a senha.`
      );
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await client.query('update user_profiles set password_hash = $1 where email = $2', [passwordHash, email]);
    console.log(`Senha definida para ${email}. Login liberado.`);
  } finally {
    await client.end();
  }
}
