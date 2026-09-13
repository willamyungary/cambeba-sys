require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const path = require('path');

const pool = require('./db/pool');
const { enforceSessionTimeout, requireAuth, attachAdmin } = require('./middleware/auth');

const authRoutes = require('./routes/auth');
const memberRoutes = require('./routes/members');
const reportRoutes = require('./routes/reports');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.set('trust proxy', 1); // Necessário no Railway (atrás de proxy) para cookies seguros

app.use(session({
  store: new pgSession({ pool, tableName: 'session', createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET || 'altere-este-segredo',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000
  }
}));

app.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    Pragma: 'no-cache',
    Expires: '0'
  });
  next();
});

app.use(enforceSessionTimeout);
app.use(attachAdmin);

// Rotas públicas
app.use('/', authRoutes);

// Rotas protegidas (exigem login)
app.get('/', requireAuth, async (req, res) => {
  const totals = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE membership_status = 'ativo') AS ativos,
      COUNT(*) FILTER (WHERE membership_status != 'ativo') AS outros,
      COUNT(*) FILTER (WHERE EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM CURRENT_DATE)) AS aniversariantes_mes,
      COUNT(*) AS total
    FROM members
  `);
  res.render('dashboard', { stats: totals.rows[0] });
});

app.use('/members', requireAuth, memberRoutes);
app.use('/reports', requireAuth, reportRoutes);

// Política de privacidade (LGPD) - página pública
app.get('/privacidade', (req, res) => {
  res.render('privacidade');
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Ocorreu um erro no servidor. Tente novamente.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
