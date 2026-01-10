// ============================================================================
// AUDITORIA: OFX vs Banco de Dados
// Compara extrato OFX com lançamentos em bank_transactions
// Execute: node auditoria_ofx_vs_banco.mjs
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

const BANCO_DIR = './banco';

// Arquivos OFX na ordem cronológica
const OFX_FILES = [
  { file: 'jan 2025.ofx', mes: '2025-01' },
  { file: 'fev 2025.ofx', mes: '2025-02' },
  { file: 'mar 2025.ofx', mes: '2025-03' },
  { file: 'abr 2025.ofx', mes: '2025-04' },
  { file: 'mai 2025.ofx', mes: '2025-05' },
  { file: 'jun 2025.ofx', mes: '2025-06' },
  { file: 'jul 2025.ofx', mes: '2025-07' },
  { file: 'ago 2025.ofx', mes: '2025-08' },
  { file: 'set 2025.ofx', mes: '2025-09' },
  { file: 'out e nov 2025.ofx', mes: '2025-10/11' },
  { file: 'extrato (2) dez.ofx', mes: '2025-12' },
  { file: 'extrato (3) jan.ofx', mes: '2026-01' }
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
    
    const dtposted = getField('DTPOSTED');
    const trnamt = getField('TRNAMT');
    const fitid = getField('FITID');
    const memo = getField('MEMO');
    
    if (dtposted && trnamt) {
      const year = dtposted.substring(0, 4);
      const month = dtposted.substring(4, 6);
      const day = dtposted.substring(6, 8);
      const transactionDate = `${year}-${month}-${day}`;
      const amount = parseFloat(trnamt);
      
      transactions.push({
        date: transactionDate,
        type: amount >= 0 ? 'credit' : 'debit',
        amount: Math.abs(amount),
        description: memo || '',
        fitid: fitid || ''
      });
    }
  }
  
  return transactions;
}

// Buscar transações do banco por mês
async function getBankTransactionsByMonth(yearMonth) {
  const [year, month] = yearMonth.split('-');
  const startDate = `${year}-${month}-01`;
  const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('bank_transactions')
    .select('*')
    .gte('transaction_date', startDate)
    .lte('transaction_date', endDate)
    .order('transaction_date');
    
  if (error) throw error;
  return data || [];
}

// Comparar transações
function compareTransactions(ofxTx, dbTx) {
  const result = {
    matched: [],
    onlyInOFX: [],
    onlyInDB: [],
    amountMismatch: []
  };
  
  // Criar mapa de transações do banco por FITID
  const dbByFitid = new Map();
  dbTx.forEach(tx => {
    if (tx.fitid) {
      dbByFitid.set(tx.fitid, tx);
    }
  });
  
  // Verificar cada transação do OFX
  const matchedFitids = new Set();
  
  for (const ofx of ofxTx) {
    if (ofx.fitid && dbByFitid.has(ofx.fitid)) {
      const db = dbByFitid.get(ofx.fitid);
      matchedFitids.add(ofx.fitid);
      
      // Verificar se valores batem
      const ofxAmount = Math.round(ofx.amount * 100);
      const dbAmount = Math.round(parseFloat(db.amount) * 100);
      
      if (ofxAmount !== dbAmount) {
        result.amountMismatch.push({
          fitid: ofx.fitid,
          date: ofx.date,
          ofxAmount: ofx.amount,
          dbAmount: parseFloat(db.amount),
          description: ofx.description
        });
      } else {
        result.matched.push(ofx);
      }
    } else {
      result.onlyInOFX.push(ofx);
    }
  }
  
  // Verificar transações no banco que não estão no OFX
  for (const db of dbTx) {
    if (db.fitid && !matchedFitids.has(db.fitid)) {
      result.onlyInDB.push({
        fitid: db.fitid,
        date: db.transaction_date,
        type: db.transaction_type,
        amount: parseFloat(db.amount),
        description: db.description
      });
    }
  }
  
  return result;
}

// Main
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║           AUDITORIA: EXTRATO OFX vs BANCO DE DADOS                           ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
  
  const auditResults = [];
  
  for (const { file, mes } of OFX_FILES) {
    const filePath = path.join(BANCO_DIR, file);
    
    if (!fs.existsSync(filePath)) {
      console.log(`\n⚠️  Arquivo não encontrado: ${file}`);
      continue;
    }
    
    console.log(`\n${'═'.repeat(78)}`);
    console.log(`📅 MÊS: ${mes} | Arquivo: ${file}`);
    console.log('─'.repeat(78));
    
    // Ler e parsear OFX
    const content = fs.readFileSync(filePath, 'latin1');
    const ofxTransactions = parseOFX(content);
    
    // Calcular totais OFX
    const ofxEntradas = ofxTransactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const ofxSaidas = ofxTransactions.filter(t => t.type === 'debit').reduce((s, t) => s + t.amount, 0);
    
    console.log(`\n📄 OFX: ${ofxTransactions.length} transações`);
    console.log(`   Entradas: R$ ${ofxEntradas.toFixed(2)}`);
    console.log(`   Saídas:   R$ ${ofxSaidas.toFixed(2)}`);
    console.log(`   Saldo:    R$ ${(ofxEntradas - ofxSaidas).toFixed(2)}`);
    
    // Buscar transações do banco
    // Para arquivo out e nov, fazer duas buscas
    let dbTransactions = [];
    if (mes === '2025-10/11') {
      const db10 = await getBankTransactionsByMonth('2025-10');
      const db11 = await getBankTransactionsByMonth('2025-11');
      dbTransactions = [...db10, ...db11];
    } else {
      dbTransactions = await getBankTransactionsByMonth(mes);
    }
    
    const dbEntradas = dbTransactions.filter(t => t.transaction_type === 'credit').reduce((s, t) => s + parseFloat(t.amount), 0);
    const dbSaidas = dbTransactions.filter(t => t.transaction_type === 'debit').reduce((s, t) => s + parseFloat(t.amount), 0);
    
    console.log(`\n💾 BANCO: ${dbTransactions.length} transações`);
    console.log(`   Entradas: R$ ${dbEntradas.toFixed(2)}`);
    console.log(`   Saídas:   R$ ${dbSaidas.toFixed(2)}`);
    console.log(`   Saldo:    R$ ${(dbEntradas - dbSaidas).toFixed(2)}`);
    
    // Comparar
    const comparison = compareTransactions(ofxTransactions, dbTransactions);
    
    console.log(`\n🔍 COMPARAÇÃO:`);
    console.log(`   ✅ Bateram:        ${comparison.matched.length}`);
    console.log(`   ⚠️  Só no OFX:     ${comparison.onlyInOFX.length}`);
    console.log(`   ⚠️  Só no Banco:   ${comparison.onlyInDB.length}`);
    console.log(`   ❌ Valor diferente: ${comparison.amountMismatch.length}`);
    
    // Mostrar detalhes dos problemas
    if (comparison.onlyInOFX.length > 0) {
      console.log(`\n   📋 TRANSAÇÕES SÓ NO OFX (faltam no banco):`);
      comparison.onlyInOFX.slice(0, 10).forEach(tx => {
        const sinal = tx.type === 'credit' ? '+' : '-';
        console.log(`      ${tx.date} | ${sinal}R$ ${tx.amount.toFixed(2).padStart(10)} | ${tx.description.substring(0, 40)}`);
      });
      if (comparison.onlyInOFX.length > 10) {
        console.log(`      ... e mais ${comparison.onlyInOFX.length - 10} transações`);
      }
    }
    
    if (comparison.onlyInDB.length > 0) {
      console.log(`\n   📋 TRANSAÇÕES SÓ NO BANCO (não estão no OFX):`);
      comparison.onlyInDB.slice(0, 10).forEach(tx => {
        const sinal = tx.type === 'credit' ? '+' : '-';
        console.log(`      ${tx.date} | ${sinal}R$ ${tx.amount.toFixed(2).padStart(10)} | ${tx.description?.substring(0, 40)}`);
      });
      if (comparison.onlyInDB.length > 10) {
        console.log(`      ... e mais ${comparison.onlyInDB.length - 10} transações`);
      }
    }
    
    if (comparison.amountMismatch.length > 0) {
      console.log(`\n   📋 TRANSAÇÕES COM VALOR DIFERENTE:`);
      comparison.amountMismatch.forEach(tx => {
        console.log(`      ${tx.date} | OFX: R$ ${tx.ofxAmount.toFixed(2)} | DB: R$ ${tx.dbAmount.toFixed(2)} | ${tx.description.substring(0, 30)}`);
      });
    }
    
    // Diferença de totais
    const diffEntradas = Math.abs(ofxEntradas - dbEntradas);
    const diffSaidas = Math.abs(ofxSaidas - dbSaidas);
    
    if (diffEntradas > 0.01 || diffSaidas > 0.01) {
      console.log(`\n   💰 DIFERENÇA DE TOTAIS:`);
      if (diffEntradas > 0.01) {
        console.log(`      Entradas: R$ ${diffEntradas.toFixed(2)} (OFX ${ofxEntradas > dbEntradas ? '>' : '<'} DB)`);
      }
      if (diffSaidas > 0.01) {
        console.log(`      Saídas: R$ ${diffSaidas.toFixed(2)} (OFX ${ofxSaidas > dbSaidas ? '>' : '<'} DB)`);
      }
    }
    
    auditResults.push({
      mes,
      file,
      ofxCount: ofxTransactions.length,
      dbCount: dbTransactions.length,
      ofxEntradas,
      ofxSaidas,
      dbEntradas,
      dbSaidas,
      matched: comparison.matched.length,
      onlyInOFX: comparison.onlyInOFX.length,
      onlyInDB: comparison.onlyInDB.length,
      amountMismatch: comparison.amountMismatch.length,
      status: comparison.onlyInOFX.length === 0 && comparison.onlyInDB.length === 0 && comparison.amountMismatch.length === 0 ? '✅' : '⚠️'
    });
  }
  
  // Resumo final
  console.log(`\n${'═'.repeat(78)}`);
  console.log('📊 RESUMO GERAL DA AUDITORIA');
  console.log('─'.repeat(78));
  console.log('Mês       | OFX  | DB   | ✅   | ⚠️OFX | ⚠️DB  | Status');
  console.log('─'.repeat(78));
  
  let totalProblems = 0;
  for (const r of auditResults) {
    const problems = r.onlyInOFX + r.onlyInDB + r.amountMismatch;
    totalProblems += problems;
    console.log(`${r.mes.padEnd(9)} | ${r.ofxCount.toString().padStart(4)} | ${r.dbCount.toString().padStart(4)} | ${r.matched.toString().padStart(4)} | ${r.onlyInOFX.toString().padStart(5)} | ${r.onlyInDB.toString().padStart(5)} | ${r.status}`);
  }
  
  console.log('─'.repeat(78));
  if (totalProblems === 0) {
    console.log('🎉 TODOS OS MESES BATERAM PERFEITAMENTE!');
  } else {
    console.log(`⚠️  Total de discrepâncias encontradas: ${totalProblems}`);
  }
}

main().catch(console.error);
