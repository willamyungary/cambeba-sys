const pool = require('../db/pool');

async function logAction(req, action, memberId, details) {
  try {
    const admin = req.session && req.session.admin;
    await pool.query(
      `INSERT INTO audit_log (admin_id, admin_username, action, member_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        admin ? admin.id : null,
        admin ? admin.username : 'desconhecido',
        action,
        memberId || null,
        details || null,
        req.ip
      ]
    );
  } catch (err) {
    console.error('Falha ao registrar log de auditoria:', err.message);
  }
}

module.exports = { logAction };
