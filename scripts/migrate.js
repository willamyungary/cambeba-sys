require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../db/pool');

async function migrate() {
  const dir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  console.log(`Encontradas ${files.length} migração(ões).`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    console.log(`Executando ${file}...`);
    try {
      await pool.query(sql);
      console.log(`OK: ${file}`);
    } catch (err) {
      console.error(`Falha ao executar ${file}:`, err.message);
      process.exit(1);
    }
  }

  console.log('Migrações concluídas com sucesso.');
  await pool.end();
}

migrate();
