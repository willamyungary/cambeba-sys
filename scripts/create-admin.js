require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');

async function createAdmin() {
  const name = process.env.ADMIN_NAME || 'Administrador';
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    console.error('Defina ADMIN_USERNAME e ADMIN_PASSWORD nas variáveis de ambiente antes de rodar este script.');
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
