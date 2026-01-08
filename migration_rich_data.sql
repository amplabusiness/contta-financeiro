-- Migration to add rich data columns and partners table

-- Add new columns to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS economic_group TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS movement_status TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_object TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS municipal_registration TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS state_registration TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS city_hall_password TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS access_code TEXT;

-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    cpf TEXT,
    role TEXT, -- 'Sócio', 'Administrador', etc.
    email TEXT,
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for searching partners
CREATE INDEX IF NOT EXISTS idx_partners_client_id ON partners(client_id);
CREATE INDEX IF NOT EXISTS idx_partners_cpf ON partners(cpf);

-- Add comment
COMMENT ON TABLE partners IS 'Tabela de sócios vinculados aos clientes';
