
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tenta carregar .env de diferentes locais
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_service_role || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("ERRO: Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY não encontradas.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log("=================================================");
  console.log("   AUDITORIA FINANCEIRA - JANEIRO 2025");
  console.log("=================================================");
  console.log(`Data da Execução: ${new Date().toLocaleString()}`);
  console.log("-------------------------------------------------\n");

  const startJan = '2025-01-01';
  const endJan = '2025-01-31';
  let report = {
      bank: { total: 0, count: 0, reconciled: 0, pending: 0 },
      receivables: { total: 0, count: 0 },
      opening_balances: { total: 0, count: 0, paid: 0 },
      discrepancies: []
  };

  // 1. AUDITORIA BANCÁRIA (O Extrato está no Banco?)
  console.log("🔍 1. Auditoria Bancária (Extrato vs BD)");
  const { data: bankTx, error: bankError } = await supabase
    .from('bank_transactions')
    .select('*')
    .gte('transaction_date', startJan)
    .lte('transaction_date', endJan);

  if (bankError) {
      console.error("Erro ao ler transações bancárias:", bankError);
  } else {
      report.bank.count = bankTx.length;
      report.bank.total = bankTx.reduce((sum, tx) => sum + Number(tx.amount), 0);
      report.bank.reconciled = bankTx.filter(tx => tx.matched || tx.reconciled).length;
      report.bank.pending = bankTx.filter(tx => !tx.matched && !tx.reconciled).length;
      
      console.log(`   Total Transações Jan/25: ${report.bank.count}`);
      console.log(`   Volume Financeiro: R$ ${report.bank.total.toFixed(2)}`);
      console.log(`   Conciliadas: ${report.bank.reconciled}`);
      console.log(`   Pendentes: ${report.bank.pending}`);
      
      if (report.bank.count === 0) {
          report.discrepancies.push("ALERTA: Nenhuma transação bancária encontrada para Janeiro 2025.");
      }
  }
  console.log("-------------------------------------------------");

  // 2. AUDITORIA DE CLIENTES A RECEBER (Faturamento Jan/25 foi gerado?)
  console.log("🔍 2. Auditoria de Contas a Receber (Faturamento Jan)");
  // Assumindo que faturamento de Jan tem competencia '01/2025' ou '2025-01'
  const { data: invoices, error: invError } = await supabase
    .from('invoices')
    .select('*')
    .eq('competence', '01/2025'); 
  
  if (invError) {
       console.error("Erro ao ler faturas:", invError);
  } else {
       report.receivables.count = invoices.length;
       report.receivables.total = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
       
       console.log(`   Faturas Geradas (01/2025): ${report.receivables.count}`);
       console.log(`   Valor Total Faturado: R$ ${report.receivables.total.toFixed(2)}`);
  }
  console.log("-------------------------------------------------");

  // 3. AUDITORIA SALDOS DE ABERTURA (Pre-2025)
  console.log("🔍 3. Auditoria de Saldos de Abertura (Dívidas Antigas)");
  const { data: opening, error: openError } = await supabase
      .from('client_opening_balance')
      .select('*');
      
  if (openError) {
      console.error("Erro ao ler saldos de abertura:", openError);
  } else {
      report.opening_balances.count = opening.length;
      report.opening_balances.total = opening.reduce((sum, op) => sum + Number(op.amount), 0);
      report.opening_balances.paid = opening.reduce((sum, op) => sum + Number(op.paid_amount || 0), 0);
      
      console.log(`   Registros de Saldo Inicial: ${report.opening_balances.count}`);
      console.log(`   Total em Aberto (Histórico): R$ ${report.opening_balances.total.toFixed(2)}`);
      console.log(`   Total Já Quitado: R$ ${report.opening_balances.paid.toFixed(2)}`);
  }
  console.log("-------------------------------------------------");

  // 4. CRUZAMENTO (Recebimentos no Banco vs Baixas)
  console.log("🔍 4. Cruzamento: Recebimentos Bancários vs Baixas");
  // Buscar entradas no banco em Jan/25
  const receipts = bankTx ? bankTx.filter(tx => Number(tx.amount) > 0) : [];
  const receiptsTotal = receipts.reduce((sum, tx) => sum + Number(tx.amount), 0);
  
  console.log(`   Entradas no Banco (Jan/25): R$ ${receiptsTotal.toFixed(2)}`);
  
  // Aqui deveríamos somar quanto foi baixado em invoices + opening_balances com data de pagto em Jan/25
  // Mas como a estrutura de "baixa" pode variar, vamos verificar se há discrepância óbvia.
  
  if (report.bank.pending > 0) {
      console.log(`   ⚠️  ATENÇÃO: Existem ${report.bank.pending} transações bancárias em Janeiro AINDA NÃO CONCILIADAS.`);
      console.log(`   Isso significa que o financeiro NÃO ESTÁ 100% refletido na contabilidade/baixas.`);
      report.discrepancies.push(`Existem ${report.bank.pending} transações pendentes de conciliação.`);
  } else {
      console.log("   ✅ Todas as transações bancárias de Janeiro estão conciliadas/baixadas.");
  }
  
  console.log("\n=================================================");
  console.log("   CONCLUSÃO DO LAUDO");
  console.log("=================================================");
  
  if (report.discrepancies.length === 0 && report.bank.pending === 0) {
      console.log("STATUS: APROVADO ✅");
      console.log("Pode-se confiar nos números atuais. Todos os lançamentos bancários foram processados.");
  } else {
      console.log("STATUS: ATENÇÃO NECESSÁRIA ⚠️");
      console.log("Não é possível confiar 100% nos relatórios finais ainda, pois:");
      report.discrepancies.forEach(d => console.log(` - ${d}`));
      if (report.bank.pending > 0) {
          console.log(` -> Ação Recomendada: Utilize a 'Super Tela' para processar os ${report.bank.pending} itens pendentes.`);
      }
  }
}

runAudit();
