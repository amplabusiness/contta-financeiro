-- BKP DE SEGURANÇA - JANEIRO 2026 - PRODUCAO
-- Data: 2026-01-06
-- Autor: Dr. Cicero (Accountant Agent)

BEGIN;

-- 1. Backup do Plano de Contas
CREATE TABLE IF NOT EXISTS bkp_20260106_chart_of_accounts AS 
SELECT * FROM chart_of_accounts;

-- 2. Backup dos Lançamentos Contábeis (Crucial!)
CREATE TABLE IF NOT EXISTS bkp_20260106_accounting_entries AS 
SELECT * FROM accounting_entries;

CREATE TABLE IF NOT EXISTS bkp_20260106_accounting_entry_items AS 
SELECT * FROM accounting_entry_items;

-- 3. Backup de Dados Financeiros Operacionais
CREATE TABLE IF NOT EXISTS bkp_20260106_invoices AS 
SELECT * FROM invoices;

CREATE TABLE IF NOT EXISTS bkp_20260106_bank_transactions AS 
SELECT * FROM bank_transactions;

-- 4. Backup de Pessoas
CREATE TABLE IF NOT EXISTS bkp_20260106_clients AS 
SELECT * FROM clients;

CREATE TABLE IF NOT EXISTS bkp_20260106_suppliers AS 
SELECT * FROM suppliers;

COMMIT;

SELECT 'Backup realizado com sucesso. Tabelas prefixadas com bkp_20260106_' as status;
