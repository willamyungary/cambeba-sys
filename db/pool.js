const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('ERRO: variável de ambiente DATABASE_URL não definida.');
}

// Railway fornece DATABASE_URL automaticamente ao adicionar o plugin PostgreSQL.
// SSL é necessário em produção no Railway, mas não localmente.
const useSSL = process.env.NODE_ENV === 'production' || (process.env.DATABASE_URL || '').includes('railway');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Erro inesperado no pool do PostgreSQL', err);
});

module.exports = pool;
