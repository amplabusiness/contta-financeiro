-- Migração para deletar lançamento duplicado da tarifa
-- Data: 28/01/2026

SET session_replication_role = 'replica';

-- Deletar lançamento duplicado (MANUTENCAO DE TITULOS-COB000005 em 06/01)
DELETE FROM accounting_entry_items WHERE entry_id = 'a90c1002-cf43-4572-ae51-0f7bb4329cc9'::uuid;
DELETE FROM accounting_entries WHERE id = 'a90c1002-cf43-4572-ae51-0f7bb4329cc9'::uuid;

SET session_replication_role = 'origin';
