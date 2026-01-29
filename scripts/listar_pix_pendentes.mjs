// scripts/listar_pix_pendentes.mjs
// Lista PIX e recebimentos que estão na transitória aguardando baixa
// Dr. Cícero - Guardião Contábil MCP

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('═'.repeat(100));
  console.log('DR. CÍCERO - ANÁLISE DE PIX PENDENTES DE BAIXA');
  console.log('═'.repeat(100));
  console.log(`Executado em: ${new Date().toLocaleString('pt-BR')}\n`);

  // Buscar recebimentos que não são COB (são PIX ou outros)
  const { data: pix } = await supabase
    .from('bank_transactions')
    .select('*')
    .gte('transaction_date', '2025-01-01')
    .lte('transaction_date', '2025-01-31')
    .gt('amount', 0)
    .not('description', 'ilike', '%COB000%')
    .order('amount', { ascending: false });

  console.log(`📊 PIX/RECEBIMENTOS AVULSOS - JANEIRO 2025\n`);
  console.log('─'.repeat(100));
  console.log('Data       | Valor       | Descrição');
  console.log('─'.repeat(100));

  let totalPix = 0;
  const pixPorCliente = {};

  for (const t of pix || []) {
    const valor = parseFloat(t.amount);
    totalPix += valor;
    
    console.log(`${t.transaction_date} | R$ ${valor.toFixed(2).padStart(10)} | ${t.description?.substring(0, 70)}`);
    
    // Tentar extrair nome do cliente do PIX
    const desc = t.description || '';
    let cliente = 'IDENTIFICAR';
    
    // PIX geralmente tem o nome após "PIX RECEBIDO" ou no final
    if (desc.includes('PIX')) {
      // Extrair nome após PIX
      const match = desc.match(/PIX.*?-\s*([A-Z][A-Z\s]+)/i) || 
                    desc.match(/PIX\s+([A-Z][A-Z\s]+)/i);
      if (match) {
        cliente = match[1].trim().substring(0, 40);
      }
    }
    
    if (!pixPorCliente[cliente]) {
      pixPorCliente[cliente] = { total: 0, transacoes: [] };
    }
    pixPorCliente[cliente].total += valor;
    pixPorCliente[cliente].transacoes.push(t);
  }

  console.log('─'.repeat(100));
  console.log(`TOTAL PIX: R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // Buscar contas de clientes para sugerir match
  const { data: contasClientes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .neq('code', '1.1.2.01');

  console.log('\n' + '═'.repeat(100));
  console.log('📋 ANÁLISE POR CLIENTE (SUGESTÃO DE BAIXA)');
  console.log('═'.repeat(100));

  for (const [clienteDesc, dados] of Object.entries(pixPorCliente)) {
    console.log(`\n▸ ${clienteDesc}`);
    console.log(`  Total: R$ ${dados.total.toFixed(2)}`);
    console.log(`  Transações: ${dados.transacoes.length}`);
    
    // Tentar encontrar conta correspondente
    const nomeBusca = clienteDesc.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').substring(0, 15);
    const contaMatch = contasClientes?.find(c => 
      c.name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(nomeBusca)
    );
    
    if (contaMatch) {
      console.log(`  ✅ Conta sugerida: ${contaMatch.code} - ${contaMatch.name}`);
    } else {
      console.log(`  ❌ Conta não encontrada - verificar manualmente`);
    }
  }

  // Comparar com saldo pendente
  console.log('\n' + '═'.repeat(100));
  console.log('📊 COMPARATIVO COM SALDO TRANSITÓRIA');
  console.log('═'.repeat(100));
  
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .single();

  const { data: itemsTransitoria } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .eq('account_id', contaTransitoria?.id);

  const saldoTransitoria = (itemsTransitoria || []).reduce(
    (s, i) => s + parseFloat(i.debit || 0) - parseFloat(i.credit || 0), 0
  );

  console.log(`\n   Saldo conta transitória:  R$ ${saldoTransitoria.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Total PIX listados:       R$ ${totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Diferença:                R$ ${(Math.abs(saldoTransitoria) - totalPix).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  console.log('\n' + '═'.repeat(100));
  console.log('📋 PARECER DO DR. CÍCERO');
  console.log('═'.repeat(100));
  console.log(`
Os PIX listados acima precisam de BAIXA MANUAL nos clientes.

FLUXO CONTÁBIL:
  D 1.1.9.01 (Transitória)  →  C 1.1.2.01.xxx (Cliente específico)

OBSERVAÇÃO SOBRE PROPRIETÁRIOS:
  Quando um proprietário (ex: I.A.) paga para várias empresas do grupo,
  a baixa deve ser feita na conta de cada empresa que estava devendo,
  não na conta do pagador.

AÇÃO RECOMENDADA:
  1. Identificar qual empresa/cliente cada PIX está pagando
  2. Verificar se existe provisão (D Cliente / C Receita) correspondente
  3. Fazer a baixa: D Transitória / C Cliente
`);

  console.log('═'.repeat(100));
}

main().catch(console.error);
