const express = require('express');
const pool = require('../db/pool');
const upload = require('../middleware/upload');
const { encrypt, decrypt, onlyDigits, maskCpf } = require('../utils/crypto');
const { logAction } = require('../utils/audit');
const { generateMemberCard } = require('../utils/pdf');

const router = express.Router();

const STATUSES = ['ativo', 'inativo', 'transferido', 'disciplina', 'falecido'];
const ADMISSION_TYPES = ['Batismo', 'Profissão de Fé', 'Transferência', 'Jurisdição', 'Reconciliação'];

function memberViewModel(row) {
  return {
    ...row,
    cpf_masked: row.cpf_encrypted ? maskCpf(decrypt(row.cpf_encrypted)) : null
  };
}

// Lista de membros com busca e filtro
router.get('/', async (req, res) => {
  const { q, status } = req.query;
  const conditions = [];
  const params = [];

  if (q) {
    params.push(`%${q}%`);
    conditions.push(`full_name ILIKE $${params.length}`);
  }
  if (status && STATUSES.includes(status)) {
    params.push(status);
    conditions.push(`membership_status = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await pool.query(
    `SELECT id, full_name, birth_date, admission_date, membership_status, role_in_church,
            (photo IS NOT NULL) AS has_photo
     FROM members ${where} ORDER BY full_name ASC`,
    params
  );

  res.render('members-list', {
    members: result.rows,
    q: q || '',
    status: status || '',
    statuses: STATUSES
  });
});

// Formulário de novo membro
router.get('/new', (req, res) => {
  res.render('member-form', { member: null, statuses: STATUSES, admissionTypes: ADMISSION_TYPES, error: null });
});

// Criar membro
router.post('/', upload.single('photo'), async (req, res) => {
  const b = req.body;

  if (!b.lgpd_consent) {
    return res.render('member-form', {
      member: b,
      statuses: STATUSES,
      admissionTypes: ADMISSION_TYPES,
      error: 'É obrigatório registrar o consentimento do titular dos dados (LGPD) para cadastrar o membro.'
    });
  }

  try {
    const cpfDigits = onlyDigits(b.cpf);
    const cpfEncrypted = cpfDigits ? encrypt(cpfDigits) : null;
    const cpfLast4 = cpfDigits ? cpfDigits.slice(-4) : null;

    const result = await pool.query(
      `INSERT INTO members (
        full_name, cpf_encrypted, cpf_last4, rg, birth_date, gender, marital_status, phone, email,
        address_street, address_number, address_district, address_city, address_state, address_zip,
        admission_date, admission_type, role_in_church, membership_status, notes,
        lgpd_consent, lgpd_consent_date, photo, photo_mime, created_by, updated_by
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,NOW(),$22,$23,$24,$24)
      RETURNING id`,
      [
        b.full_name, cpfEncrypted, cpfLast4, b.rg || null, b.birth_date || null, b.gender || null,
        b.marital_status || null, b.phone || null, b.email || null,
        b.address_street || null, b.address_number || null, b.address_district || null,
        b.address_city || null, b.address_state || null, b.address_zip || null,
        b.admission_date || null, b.admission_type || null, b.role_in_church || null,
        b.membership_status || 'ativo', b.notes || null,
        true, req.file ? req.file.buffer : null, req.file ? req.file.mimetype : null,
        req.session.admin.id
      ]
    );

    await logAction(req, 'create', result.rows[0].id, `Cadastro de ${b.full_name}`);
    res.redirect('/members');
  } catch (err) {
    console.error(err);
    res.render('member-form', {
      member: b,
      statuses: STATUSES,
      admissionTypes: ADMISSION_TYPES,
      error: 'Erro ao salvar membro: ' + err.message
    });
  }
});

// Visualizar membro
router.get('/:id', async (req, res) => {
  const result = await pool.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).send('Membro não encontrado.');
  await logAction(req, 'view', req.params.id, null);
  res.render('member-view', { member: memberViewModel(result.rows[0]) });
});

// Consultar log do membro
router.get('/:id/log', async (req, res) => {
  const memberResult = await pool.query('SELECT id, full_name FROM members WHERE id = $1', [req.params.id]);
  if (!memberResult.rows[0]) return res.status(404).send('Membro não encontrado.');

  const history = await pool.query(
    `SELECT action, admin_username, details, created_at
     FROM audit_log
     WHERE member_id = $1
     ORDER BY created_at DESC, id DESC`,
    [req.params.id]
  );
  res.render('member-log', { member: memberResult.rows[0], history: history.rows });
});

// Formulário de edição
router.get('/:id/edit', async (req, res) => {
  const result = await pool.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  if (!result.rows[0]) return res.status(404).send('Membro não encontrado.');
  const member = result.rows[0];
  member.cpf = member.cpf_encrypted ? decrypt(member.cpf_encrypted) : '';
  res.render('member-form', { member, statuses: STATUSES, admissionTypes: ADMISSION_TYPES, error: null });
});

// Atualizar membro
router.post('/:id', upload.single('photo'), async (req, res) => {
  const b = req.body;
  try {
    const cpfDigits = onlyDigits(b.cpf);
    const cpfEncrypted = cpfDigits ? encrypt(cpfDigits) : null;
    const cpfLast4 = cpfDigits ? cpfDigits.slice(-4) : null;

    const photoUpdate = req.file
      ? ', photo = $photo, photo_mime = $photo_mime'
      : '';

    const query = `
      UPDATE members SET
        full_name=$1, cpf_encrypted=$2, cpf_last4=$3, rg=$4, birth_date=$5, gender=$6,
        marital_status=$7, phone=$8, email=$9, address_street=$10, address_number=$11,
        address_district=$12, address_city=$13, address_state=$14, address_zip=$15,
        admission_date=$16, admission_type=$17, role_in_church=$18, membership_status=$19,
        notes=$20, updated_at=NOW(), updated_by=$21
        ${req.file ? ', photo=$22, photo_mime=$23' : ''}
      WHERE id=$${req.file ? 24 : 22}
    `;

    const params = [
      b.full_name, cpfEncrypted, cpfLast4, b.rg || null, b.birth_date || null, b.gender || null,
      b.marital_status || null, b.phone || null, b.email || null,
      b.address_street || null, b.address_number || null, b.address_district || null,
      b.address_city || null, b.address_state || null, b.address_zip || null,
      b.admission_date || null, b.admission_type || null, b.role_in_church || null,
      b.membership_status || 'ativo', b.notes || null, req.session.admin.id
    ];

    if (req.file) {
      params.push(req.file.buffer, req.file.mimetype);
    }
    params.push(req.params.id);

    await pool.query(query, params);
    await logAction(req, 'update', req.params.id, `Atualização de ${b.full_name}`);
    res.redirect(`/members/${req.params.id}`);
  } catch (err) {
    console.error(err);
    res.render('member-form', {
      member: { ...b, id: req.params.id },
      statuses: STATUSES,
      admissionTypes: ADMISSION_TYPES,
      error: 'Erro ao atualizar: ' + err.message
    });
  }
});

// Excluir membro (direito ao esquecimento - LGPD)
router.post('/:id/delete', async (req, res) => {
  const result = await pool.query('SELECT full_name FROM members WHERE id = $1', [req.params.id]);
  await pool.query('DELETE FROM members WHERE id = $1', [req.params.id]);
  await logAction(req, 'delete', req.params.id, `Exclusão de ${result.rows[0] ? result.rows[0].full_name : ''} (direito ao esquecimento)`);
  res.redirect('/members');
});

// Servir foto do membro
router.get('/:id/photo', async (req, res) => {
  const result = await pool.query('SELECT photo, photo_mime FROM members WHERE id = $1', [req.params.id]);
  const row = result.rows[0];
  if (!row || !row.photo) {
    return res.redirect('/img/sem-foto.svg');
  }
  res.set('Content-Type', row.photo_mime || 'image/jpeg');
  res.send(row.photo);
});

// Gerar carteirinha em PDF
router.get('/:id/carteirinha', async (req, res) => {
  const result = await pool.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  const member = result.rows[0];
  if (!member) return res.status(404).send('Membro não encontrado.');

  await logAction(req, 'card_print', member.id, `Carteirinha gerada para ${member.full_name}`);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Content-Disposition', `inline; filename="carteirinha-${member.id}.pdf"`);

  const doc = generateMemberCard(member);
  doc.pipe(res);
  doc.end();
});

// Exportação dos dados do titular (portabilidade - LGPD)
router.get('/:id/exportar-dados', async (req, res) => {
  const result = await pool.query('SELECT * FROM members WHERE id = $1', [req.params.id]);
  const member = result.rows[0];
  if (!member) return res.status(404).send('Membro não encontrado.');

  const exportData = { ...member };
  delete exportData.photo;
  exportData.cpf = member.cpf_encrypted ? decrypt(member.cpf_encrypted) : null;
  delete exportData.cpf_encrypted;

  await logAction(req, 'export', member.id, `Exportação de dados (portabilidade LGPD) de ${member.full_name}`);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="dados-${member.id}.json"`);
  res.send(JSON.stringify(exportData, null, 2));
});

module.exports = router;
