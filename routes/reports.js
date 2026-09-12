const express = require('express');
const pool = require('../db/pool');
const { logAction } = require('../utils/audit');
const { generateActiveMembersReport, generateBirthdaysReport } = require('../utils/pdf');

const router = express.Router();

router.get('/', (req, res) => {
  res.render('reports', { currentMonth: new Date().getMonth() + 1 });
});

router.get('/membros-ativos', async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM members WHERE membership_status = 'ativo' ORDER BY full_name ASC`
  );
  await logAction(req, 'report', null, `Relatório de membros ativos (${result.rows.length} membros)`);

  const doc = generateActiveMembersReport(result.rows);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="membros-ativos.pdf"');
  doc.pipe(res);
  doc.end();
});

router.get('/aniversariantes', async (req, res) => {
  const month = parseInt(req.query.mes, 10) || (new Date().getMonth() + 1);
  const result = await pool.query(
    `SELECT * FROM members
     WHERE membership_status = 'ativo' AND birth_date IS NOT NULL
       AND EXTRACT(MONTH FROM birth_date) = $1
     ORDER BY EXTRACT(DAY FROM birth_date) ASC`,
    [month]
  );
  await logAction(req, 'report', null, `Relatório de aniversariantes do mês ${month} (${result.rows.length} membros)`);

  const doc = generateBirthdaysReport(result.rows, month);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="aniversariantes.pdf"');
  doc.pipe(res);
  doc.end();
});

module.exports = router;
