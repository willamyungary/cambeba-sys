const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { logAction } = require('../utils/audit');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.admin) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT * FROM admins WHERE username = $1 AND active = TRUE',
      [username]
    );
    const admin = result.rows[0];

    if (!admin) {
      return res.render('login', { error: 'Usuário ou senha inválidos.' });
    }

    const match = await bcrypt.compare(password || '', admin.password_hash);
    if (!match) {
      return res.render('login', { error: 'Usuário ou senha inválidos.' });
    }

    req.session.admin = {
      id: admin.id,
      username: admin.username,
      name: admin.name
    };
    req.session.lastActivityAt = Date.now();
    await logAction(req, 'login', null, `Login de ${admin.username}`);

    const returnTo = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(returnTo || '/');
  } catch (err) {
    console.error(err);
    res.render('login', { error: 'Erro ao autenticar. Tente novamente.' });
  }
});

router.post('/logout', async (req, res) => {
  if (req.session.admin) {
    await logAction(req, 'logout', null, `Logout de ${req.session.admin.username}`);
  }
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

module.exports = router;
