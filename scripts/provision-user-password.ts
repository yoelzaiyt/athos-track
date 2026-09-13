// Define/atualiza a senha de login de um usuário já cadastrado em
// user_profiles, pro backend próprio (server/api) — substitui
// provision-user-auth.ts (que dependia do GoTrue/auth.users do Supabase e só
// se aplica enquanto o projeto ainda estiver rodando sobre o Supabase).
//
// Uso: DATABASE_URL=postgresql://... npm run user:set-password -- <email>
//
// A senha é PEDIDA NA TELA, sem eco, e digitada duas vezes. Não é mais aceita
// como argumento (card #26 do Trello): senha na linha de comando fica no
// histórico do shell, na lista de processos e no transcript de qualquer
// ferramenta que rode o comando — foi assim que senhas de produção vazaram em
// 11/09/2026. Sem terminal interativo (CI, pipe), a senha é lida da primeira
// linha do stdin: `printf '%s\n' "$SENHA" | npm run user:set-password -- <email>`.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import readline from 'node:readline';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import { sslFor } from '../server/db/connectionSsl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, '..');
const MIN_LENGTH = 6;

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

// Lê uma linha sem ecoar o que é digitado (terminal) ou a primeira linha do
// stdin (sem terminal).
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
    if (process.stdin.isTTY) {
      process.stdout.write(question);
      // Silencia o eco: o readline chama _writeToOutput para cada tecla.
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = () => {};
    }
    rl.question(process.stdin.isTTY ? '' : question, (answer) => {
      if (process.stdin.isTTY) process.stdout.write('\n');
      rl.close();
      resolve(answer);
    });
  });
}

async function readPassword(): Promise<string | null> {
  const password = await askHidden('Nova senha: ');
  if (process.stdin.isTTY) {
    const confirmation = await askHidden('Repita a senha: ');
    if (password !== confirmation) {
      console.error('As senhas não conferem. Nada foi alterado.');
      return null;
    }
  }
  return password;
}

async function main() {
  const [, , email, extra] = process.argv;

  if (extra !== undefined) {
    console.error(
      'A senha não é mais aceita como argumento: ela ficaria no histórico do shell.\n' +
        'Rode só com o e-mail e digite a senha quando for pedida:\n' +
        '  npm run user:set-password -- <email>'
    );
    process.exitCode = 1;
    return;
  }
  if (!email) {
    console.error('Uso: npm run user:set-password -- <email>');
    process.exitCode = 1;
    return;
  }
  if (!process.env.DATABASE_URL) {
    console.error('Defina DATABASE_URL (connection string do Postgres).');
    process.exitCode = 1;
    return;
  }

  const password = await readPassword();
  if (password === null) {
    process.exitCode = 1;
    return;
  }
  if (password.length < MIN_LENGTH) {
    console.error(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres. Nada foi alterado.`);
    process.exitCode = 1;
    return;
  }

  const connectionString = process.env.DATABASE_URL;
  const client = new Client({
    connectionString,
    ssl: sslFor(connectionString),
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
    // session_version++ (SEC-008): troca de senha revoga qualquer token já
    // emitido pra essa conta, não só libera a senha nova — sem isso, um
    // token vazado continuaria válido mesmo depois da vítima "resolver" o
    // problema trocando a senha.
    await client.query(
      'update user_profiles set password_hash = $1, session_version = session_version + 1 where email = $2',
      [passwordHash, email]
    );
    console.log(`Senha definida para ${email}. Sessões antigas revogadas. Login liberado.`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('FALHOU:', err.message);
  process.exitCode = 1;
});
