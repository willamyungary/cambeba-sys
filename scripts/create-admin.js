require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

function promptPassword() {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    let password = '';

    if (!stdin.isTTY || !stdout.isTTY) {
      reject(new Error('Informe ADMIN_PASSWORD ou execute o comando em um terminal interativo.'));
      return;
    }

    stdout.write('Senha (mínimo 8 caracteres): ');
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    const finish = (error) => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener('data', onData);
      stdout.write('\n');
      if (error) reject(error);
      else resolve(password);
    };

    const onData = (chunk) => {
      if (chunk === '\u0003') {
        finish(new Error('Operação cancelada.'));
      } else if (chunk === '\r' || chunk === '\n') {
        finish();
      } else if (chunk === '\u007f' || chunk === '\b') {
        password = password.slice(0, -1);
      } else {
        password += chunk;
      }
    };

    stdin.on('data', onData);
  });
}

async function createAdmin() {
  const [usernameArg, nameArg] = process.argv.slice(2);
  const name = nameArg || process.env.ADMIN_NAME || 'Administrador';
  const username = usernameArg || process.env.ADMIN_USERNAME;

  if (!username) {
    console.error('Uso: npm run create-admin -- nome_usuario "Nome Completo"');
    process.exit(1);
  }

  const password = process.env.ADMIN_PASSWORD || await promptPassword();

  if (!password) {
    console.error('A senha não pode ficar vazia.');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('A senha do administrador deve ter pelo menos 8 caracteres.');
    process.exit(1);
  }

  const existing = await pool.query('SELECT id FROM admins WHERE username = $1', [username]);
  if (existing.rows.length > 0) {
    console.log(`Administrador "${username}" já existe. Nada foi alterado.`);
    await pool.end();
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query(
    'INSERT INTO admins (name, username, password_hash) VALUES ($1, $2, $3)',
    [name, username, hash]
  );

  console.log(`Administrador "${username}" criado com sucesso.`);
  await pool.end();
}

createAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
