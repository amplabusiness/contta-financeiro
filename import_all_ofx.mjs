// ============================================================================
// Script para importar TODOS os OFX de Jan/2025 a Jan/2026
// Execute: node import_all_ofx.mjs
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Arquivos OFX na ordem cronológica
const OFX_FILES = [
  'jan 2025.ofx',
  'fev 2025.ofx',
  'mar 2025.ofx',
  'abr 2025.ofx',
  'mai 2025.ofx',
  'jun 2025.ofx',
  'jul 2025.ofx',
  'ago 2025.ofx',
  'set 2025.ofx',
  'out e nov 2025.ofx',
  'extrato (2) dez.ofx',
  'extrato (3) jan.ofx'  // Janeiro 2026
];

const BANCO_DIR = './banco';

// Parsear arquivo OFX
function parseOFX(content) {
  const transactions = [];
  
  // Encontrar todas as transações
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
    const checknum = getField('CHECKNUM');
    
    if (dtposted && trnamt) {
      // Parsear data (formato: YYYYMMDDHHMMSS ou YYYYMMDD)
      const year = dtposted.substring(0, 4);
      const month = dtposted.substring(4, 6);
      const day = dtposted.substring(6, 8);
      const transactionDate = `${year}-${month}-${day}`;
      
      // Parsear valor
      const amount = parseFloat(trnamt);
      
      transactions.push({
        transaction_date: transactionDate,
        transaction_type: amount >= 0 ? 'credit' : 'debit',
        amount: Math.abs(amount),
        description: memo || '',
        document_number: refnum || null,
        fitid: fitid || null
      });
    }
  }
  
  return transactions;
}

// Obter ou criar conta bancária Sicredi
async function getOrCreateBankAccount() {
  // Verificar se já existe
  const { data: existing } = await supabase
    .from('bank_accounts')
    .select('id')
    .or('name.eq.Sicredi,bank_name.eq.Sicredi')
    .limit(1)
    .single();
    
  if (existing) {
    return existing.id;
  }
  
  // Criar nova conta
  const { data: newAccount, error } = await supabase
    .from('bank_accounts')
    .insert({
      name: 'Sicredi',
      bank_name: 'Sicredi',
      bank_code: '748',
      agency: '3950',
      account_number: '278068',
      account_type: 'checking',
      is_active: true
    })
    .select('id')
    .single();
    
  if (error) throw error;
  return newAccount.id;
}

// Criar registro de importação
async function createImport(bankAccountId, fileName, startDate, endDate, totalTx) {
  const { data, error } = await supabase
    .from('bank_imports')
    .insert({
      bank_account_id: bankAccountId,
      file_name: fileName,
      start_date: startDate,
      end_date: endDate,
      total_transactions: totalTx
    })
    .select('id')
    .single();
    
  if (error) {
    console.log('Aviso: Não foi possível criar registro de importação:', error.message);
    return null;
  }
  return data.id;
}

// Importar transações de um arquivo OFX
async function importOFXFile(filePath, bankAccountId) {
  const fileName = path.basename(filePath);
  console.log(`\n📄 Processando: ${fileName}`);
  
  // Ler arquivo
  const content = fs.readFileSync(filePath, 'latin1');
  
  // Parsear transações
  const transactions = parseOFX(content);
  console.log(`   Transações encontradas: ${transactions.length}`);
  
  if (transactions.length === 0) {
    console.log('   ⚠️ Nenhuma transação encontrada');
    return { imported: 0, skipped: 0, errors: 0 };
  }
  
  // Datas para o registro de importação
  const dates = transactions.map(t => t.transaction_date).sort();
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  
  // Criar registro de importação
  const importId = await createImport(bankAccountId, fileName, startDate, endDate, transactions.length);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  // Inserir transações em lotes de 100
  const batchSize = 100;
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    
    // Preparar dados para inserção
    const toInsert = [];
    
    for (const tx of batch) {
      // Verificar se já existe (pelo FITID)
      if (tx.fitid) {
        const { data: existing } = await supabase
          .from('bank_transactions')
          .select('id')
          .eq('fitid', tx.fitid)
          .single();
          
        if (existing) {
          skipped++;
          continue;
        }
      }
      
      toInsert.push({
        bank_account_id: bankAccountId,
        import_id: importId,
        ...tx
      });
    }
    
    // Inserir batch
    if (toInsert.length > 0) {
      const { error } = await supabase
        .from('bank_transactions')
        .insert(toInsert);
        
      if (error) {
        console.log(`   ❌ Erro ao inserir batch: ${error.message}`);
        errors += toInsert.length;
      } else {
        imported += toInsert.length;
      }
    }
  }
  
  console.log(`   ✅ Importadas: ${imported} | ⏭️ Puladas (duplicadas): ${skipped} | ❌ Erros: ${errors}`);
  
  return { imported, skipped, errors };
}

// Main
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║      IMPORTAÇÃO DE OFX - Jan/2025 a Jan/2026                 ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  try {
    // Obter conta bancária
    const bankAccountId = await getOrCreateBankAccount();
    console.log(`\n🏦 Conta bancária: ${bankAccountId}`);
    
    // Verificar quantas transações já existem
    const { count: existingCount } = await supabase
      .from('bank_transactions')
      .select('*', { count: 'exact', head: true });
    console.log(`📊 Transações existentes: ${existingCount || 0}`);
    
    let totalImported = 0;
    let totalSkipped = 0;
    let totalErrors = 0;
    
    // Processar cada arquivo
    for (const fileName of OFX_FILES) {
      const filePath = path.join(BANCO_DIR, fileName);
      
      if (!fs.existsSync(filePath)) {
        console.log(`\n⚠️ Arquivo não encontrado: ${fileName}`);
        continue;
      }
      
      const result = await importOFXFile(filePath, bankAccountId);
      totalImported += result.imported;
      totalSkipped += result.skipped;
      totalErrors += result.errors;
    }
    
    // Resumo final
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    RESUMO DA IMPORTAÇÃO                      ║');
    console.log('╠══════════════════════════════════════════════════════════════╣');
    console.log(`║  Total importadas:    ${totalImported.toString().padStart(5)}                                 ║`);
    console.log(`║  Total puladas:       ${totalSkipped.toString().padStart(5)}                                 ║`);
    console.log(`║  Total erros:         ${totalErrors.toString().padStart(5)}                                 ║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');
    
    // Verificar totais por mês
    console.log('\n📅 Transações por mês:');
    const { data: monthly } = await supabase
      .from('bank_transactions')
      .select('transaction_date, amount, transaction_type')
      .order('transaction_date');
    
    if (monthly) {
      const byMonth = {};
      monthly.forEach(tx => {
        const month = tx.transaction_date.substring(0, 7);
        if (!byMonth[month]) {
          byMonth[month] = { count: 0, credits: 0, debits: 0 };
        }
        byMonth[month].count++;
        if (tx.transaction_type === 'credit') {
          byMonth[month].credits += Number(tx.amount);
        } else {
          byMonth[month].debits += Number(tx.amount);
        }
      });
      
      Object.keys(byMonth).sort().forEach(month => {
        const m = byMonth[month];
        console.log(`   ${month}: ${m.count} transações | Entradas: R$ ${m.credits.toFixed(2)} | Saídas: R$ ${m.debits.toFixed(2)}`);
      });
    }
    
  } catch (error) {
    console.error('Erro:', error);
    process.exit(1);
  }
}

main();
