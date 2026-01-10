// ============================================================================
// Gerar SQL para importar transações de Dezembro 2025 e Janeiro 2026
// Execute: node generate_sql_dez_jan.mjs > SQL_IMPORT_DEZ_JAN.sql
// ============================================================================

import fs from 'fs';
import path from 'path';

const BANCO_DIR = './banco';

// Arquivos a processar
const OFX_FILES = [
  'extrato (2) dez.ofx',  // Dezembro 2025
  'extrato (3) jan.ofx'   // Janeiro 2026
];

// Parsear arquivo OFX
function parseOFX(content) {
  const transactions = [];
  
  const stmttrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/g;
  let match;
  
  while ((match = stmttrnRegex.exec(content)) !== null) {
    const txBlock = match[1];
    
    const getField = (fieldName) => {
      const regex = new RegExp(`<${fieldName}>([^<\\n]+)`);
      const m = txBlock.match(regex);
      return m ? m[1].trim() : null;
    };
    
    const trntype = getField('TRNTYPE');
    const dtposted = getField('DTPOSTED');
    const trnamt = getField('TRNAMT');
    const fitid = getField('FITID');
    const memo = getField('MEMO');
    const refnum = getField('REFNUM');
    
    if (dtposted && trnamt) {
      const year = dtposted.substring(0, 4);
      const month = dtposted.substring(4, 6);
      const day = dtposted.substring(6, 8);
      const transactionDate = `${year}-${month}-${day}`;
      
      const amount = parseFloat(trnamt);
      
      transactions.push({
        transaction_date: transactionDate,
        transaction_type: amount >= 0 ? 'credit' : 'debit',
        amount: Math.abs(amount),
        description: (memo || '').replace(/'/g, "''"), // Escape SQL
        document_number: refnum || '',
        fitid: fitid || ''
      });
    }
  }
  
  return transactions;
}

// Main
function main() {
  let allTransactions = [];
  
  for (const fileName of OFX_FILES) {
    const filePath = path.join(BANCO_DIR, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.error(`-- Arquivo não encontrado: ${fileName}`);
      continue;
    }
    
    const content = fs.readFileSync(filePath, 'latin1');
    const transactions = parseOFX(content);
    allTransactions = allTransactions.concat(transactions);
    console.error(`-- ${fileName}: ${transactions.length} transações`);
  }
  
  // Gerar SQL
  console.log(`-- ============================================================================`);
  console.log(`-- IMPORTAR TRANSAÇÕES DEZEMBRO 2025 E JANEIRO 2026`);
  console.log(`-- Gerado automaticamente em ${new Date().toISOString()}`);
  console.log(`-- Total: ${allTransactions.length} transações`);
  console.log(`-- Execute no Supabase Dashboard: SQL Editor`);
  console.log(`-- ============================================================================`);
  console.log();
  
  console.log(`-- Desabilitar triggers que criam lançamentos contábeis`);
  console.log(`DO $$`);
  console.log(`DECLARE r RECORD;`);
  console.log(`BEGIN`);
  console.log(`    FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'bank_transactions'::regclass AND NOT tgisinternal`);
  console.log(`    LOOP`);
  console.log(`        EXECUTE format('ALTER TABLE bank_transactions DISABLE TRIGGER %I', r.tgname);`);
  console.log(`    END LOOP;`);
  console.log(`END $$;`);
  console.log();
  
  console.log(`-- Inserir transações`);
  console.log(`INSERT INTO bank_transactions (bank_account_id, transaction_date, transaction_type, amount, description, document_number, fitid)`);
  console.log(`SELECT `);
  console.log(`    (SELECT id FROM bank_accounts WHERE name = 'Sicredi' OR bank_name = 'Sicredi' LIMIT 1),`);
  console.log(`    t.transaction_date,`);
  console.log(`    t.transaction_type,`);
  console.log(`    t.amount,`);
  console.log(`    t.description,`);
  console.log(`    t.document_number,`);
  console.log(`    t.fitid`);
  console.log(`FROM (`);
  console.log(`    VALUES`);
  
  allTransactions.forEach((tx, i) => {
    const comma = i < allTransactions.length - 1 ? ',' : '';
    console.log(`        ('${tx.transaction_date}'::date, '${tx.transaction_type}', ${tx.amount.toFixed(2)}, '${tx.description}', '${tx.document_number}', '${tx.fitid}')${comma}`);
  });
  
  console.log(`) AS t(transaction_date, transaction_type, amount, description, document_number, fitid)`);
  console.log(`WHERE NOT EXISTS (`);
  console.log(`    SELECT 1 FROM bank_transactions bt WHERE bt.fitid = t.fitid AND bt.fitid != ''`);
  console.log(`);`);
  console.log();
  
  console.log(`-- Reabilitar triggers`);
  console.log(`DO $$`);
  console.log(`DECLARE r RECORD;`);
  console.log(`BEGIN`);
  console.log(`    FOR r IN SELECT tgname FROM pg_trigger WHERE tgrelid = 'bank_transactions'::regclass AND NOT tgisinternal`);
  console.log(`    LOOP`);
  console.log(`        EXECUTE format('ALTER TABLE bank_transactions ENABLE TRIGGER %I', r.tgname);`);
  console.log(`    END LOOP;`);
  console.log(`END $$;`);
  console.log();
  
  console.log(`-- Verificar resultado`);
  console.log(`SELECT `);
  console.log(`    to_char(transaction_date, 'YYYY-MM') AS mes,`);
  console.log(`    COUNT(*) AS total,`);
  console.log(`    SUM(CASE WHEN transaction_type = 'credit' THEN amount ELSE 0 END) AS entradas,`);
  console.log(`    SUM(CASE WHEN transaction_type = 'debit' THEN amount ELSE 0 END) AS saidas`);
  console.log(`FROM bank_transactions`);
  console.log(`GROUP BY to_char(transaction_date, 'YYYY-MM')`);
  console.log(`ORDER BY mes;`);
}

main();
