const crypto = require('crypto');

const ALGO = 'aes-256-gcm';

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY precisa ter pelo menos 32 caracteres. Configure essa variável de ambiente.');
  }
  // Usa os primeiros 32 bytes da chave configurada
  return Buffer.from(key.padEnd(32, '0').slice(0, 32));
}

function encrypt(text) {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Formato armazenado: iv:authTag:ciphertext (tudo em base64)
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':');
}

function decrypt(payload) {
  if (!payload) return null;
  try {
    const [ivB64, tagB64, dataB64] = payload.split(':');
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    return null;
  }
}

function onlyDigits(str) {
  return (str || '').replace(/\D/g, '');
}

function maskCpf(cpf) {
  const digits = onlyDigits(cpf);
  if (digits.length !== 11) return cpf || '';
  return `***.${digits.slice(3, 6)}.***-${digits.slice(9, 11)}`;
}

module.exports = { encrypt, decrypt, onlyDigits, maskCpf };
