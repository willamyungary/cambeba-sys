-- Sistema de Membros - Igreja Presbiteriana do Cambeba
-- Migração inicial

CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  username VARCHAR(80) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(200) NOT NULL,
  cpf_encrypted TEXT,               -- CPF criptografado (AES-256-GCM) em repouso
  cpf_last4 VARCHAR(4),             -- últimos 4 dígitos, apenas para exibição/busca
  rg VARCHAR(30),
  birth_date DATE,
  gender VARCHAR(20),
  marital_status VARCHAR(30),
  phone VARCHAR(30),
  email VARCHAR(150),
  address_street VARCHAR(200),
  address_number VARCHAR(20),
  address_district VARCHAR(120),
  address_city VARCHAR(120),
  address_state VARCHAR(2),
  address_zip VARCHAR(12),
  photo BYTEA,                      -- foto armazenada no banco (sobrevive a redeploys no Railway)
  photo_mime VARCHAR(50),
  admission_date DATE,
  admission_type VARCHAR(40),       -- batismo, profissão de fé, transferência, jurisdição
  role_in_church VARCHAR(60),       -- membro, presbítero, diácono, pastor, etc.
  membership_status VARCHAR(20) NOT NULL DEFAULT 'ativo', -- ativo, inativo, transferido, disciplina, falecido
  notes TEXT,
  lgpd_consent BOOLEAN NOT NULL DEFAULT FALSE,
  lgpd_consent_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES admins(id),
  updated_by INTEGER REFERENCES admins(id)
);

CREATE INDEX IF NOT EXISTS idx_members_status ON members(membership_status);
CREATE INDEX IF NOT EXISTS idx_members_birth_month ON members(EXTRACT(MONTH FROM birth_date));
CREATE INDEX IF NOT EXISTS idx_members_name ON members(full_name);

-- Trilha de auditoria exigida por boas práticas de LGPD (quem acessou/alterou dados de quem)
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id),
  admin_username VARCHAR(80),
  action VARCHAR(60) NOT NULL,      -- create, update, view, delete, export, card_print
  member_id INTEGER,
  details TEXT,
  ip_address VARCHAR(60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_member ON audit_log(member_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);

-- Tabela de sessões (usada pelo connect-pg-simple)
CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL COLLATE "default",
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
)
WITH (OIDS=FALSE);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey'
  ) THEN
    ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
