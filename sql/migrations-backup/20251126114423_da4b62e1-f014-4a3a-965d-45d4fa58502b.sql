-- Remove the unique constraint on normalized client names
-- This constraint is too strict and causes false positives
-- CNPJ/CPF are the true unique identifiers for clients

DROP INDEX IF EXISTS idx_clients_name_normalized;