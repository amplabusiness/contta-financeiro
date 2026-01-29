// scripts/diagnostico_baixas_jan2025.mjs
// Diagnóstico completo das baixas de clientes para Janeiro 2025
// Consulta: Dr. Cícero (Guardião Contábil)

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('═'.repeat(100));
  console.log('DR. CÍCERO - DIAGNÓSTICO DE BAIXAS DE CLIENTES - JANEIRO 2025');
  console.log('═'.repeat(100));
  console.log(`Executado em: ${new Date().toLocaleString('pt-BR')}\n`);

  // 1. SALDO DA CONTA TRANSITÓRIA
  console.log('📊 1. CONTA TRANSITÓRIA (1.1.9.01)');
  console.log('─'.repeat(60));
  
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', '1.1.9.01')
    .single();

  const { data: itemsTransitoria } = await supabase
    .from('accounting_entry_items')
    .select('debit, credit')
    .eq('account_id', contaTransitoria?.id);

  const totalD = (itemsTransitoria || []).reduce((s, i) => s + parseFloat(i.debit || 0), 0);
  const totalC = (itemsTransitoria || []).reduce((s, i) => s + parseFloat(i.credit || 0), 0);
  const saldoT = totalD - totalC;

  console.log(`   Débitos:  R$ ${totalD.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Créditos: R$ ${totalC.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Saldo:    R$ ${saldoT.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  
  if (saldoT < -0.01) {
    console.log(`\n   ⚠️  PENDENTE: R$ ${Math.abs(saldoT).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de recebimentos aguardando baixa nos clientes`);
  } else if (Math.abs(saldoT) < 0.01) {
    console.log(`\n   ✅ Conta zerada - todas as baixas foram realizadas!`);
  }

  // 2. LANÇAMENTOS DE BAIXA EXISTENTES
  console.log('\n📊 2. LANÇAMENTOS DE BAIXA JÁ EXISTENTES');
  console.log('─'.repeat(60));

  const { data: baixasExistentes, count: totalBaixas } = await supabase
    .from('accounting_entries')
    .select('id, entry_date, internal_code, description', { count: 'exact' })
    .ilike('internal_code', 'boleto_%')
    .order('entry_date');

  console.log(`   Total de lançamentos boleto_*: ${totalBaixas}`);
  
  // Agrupar por mês
  const porMes = {};
  (baixasExistentes || []).forEach(b => {
    const mes = b.entry_date?.substring(0, 7) || 'N/A';
    porMes[mes] = (porMes[mes] || 0) + 1;
  });
  
  console.log('\n   Por mês:');
  Object.entries(porMes).sort().forEach(([mes, qtd]) => {
    console.log(`      ${mes}: ${qtd} lançamentos`);
  });

  // 3. VERIFICAR CSV DE JANEIRO (COMPETÊNCIA DEZ/2024)
  console.log('\n📊 3. CSV DE BOLETOS - JANEIRO 2025 (COMPETÊNCIA DEZ/2024)');
  console.log('─'.repeat(60));

  const csvJan = 'banco/clientes boletos jan.csv';
  if (existsSync(csvJan)) {
    const conteudo = readFileSync(csvJan, 'latin1');
    const linhas = conteudo.split('\n').filter(l => l.trim()).slice(1);
    
    const boletosJan = linhas.map(l => {
      const c = l.split(';');
      return {
        doc: c[0]?.trim(),
        numBoleto: c[1]?.trim(),
        pagador: c[2]?.trim(),
        valor: parseFloat((c[6] || '0').replace(/\./g, '').replace(',', '.'))
      };
    }).filter(b => b.numBoleto);

    console.log(`   Arquivo: ${csvJan}`);
    console.log(`   Total de boletos: ${boletosJan.length}`);
    console.log(`   Valor total: R$ ${boletosJan.reduce((s, b) => s + b.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    // Verificar quantos já foram lançados
    let jaLancados = 0;
    let pendentes = [];
    
    for (const boleto of boletosJan) {
      const internalCode = `boleto_${boleto.numBoleto.replace(/\//g, '_')}_${boleto.doc}`;
      const existe = baixasExistentes?.find(b => b.internal_code === internalCode);
      if (existe) {
        jaLancados++;
      } else {
        pendentes.push(boleto);
      }
    }

    console.log(`\n   Já lançados: ${jaLancados}`);
    console.log(`   Pendentes: ${pendentes.length}`);

    if (pendentes.length > 0 && pendentes.length <= 20) {
      console.log('\n   Boletos pendentes:');
      pendentes.forEach(p => {
        console.log(`      ${p.doc} | ${p.numBoleto} | ${p.pagador?.substring(0, 30)} | R$ ${p.valor.toFixed(2)}`);
      });
    }
  } else {
    console.log(`   ❌ Arquivo não encontrado: ${csvJan}`);
  }

  // 4. VERIFICAR CSV DE FEVEREIRO (COMPETÊNCIA JAN/2025)
  console.log('\n📊 4. CSV DE BOLETOS - FEVEREIRO 2025 (COMPETÊNCIA JAN/2025)');
  console.log('─'.repeat(60));

  const csvFev = 'banco/clientes de boleto fev.csv';
  if (existsSync(csvFev)) {
    const conteudo = readFileSync(csvFev, 'latin1');
    const linhas = conteudo.split('\n').filter(l => l.trim()).slice(1);
    
    const boletosFev = linhas.map(l => {
      const c = l.split(';');
      // Formato diferente: valor com R$
      const valorStr = (c[5] || '0').replace('R$', '').replace(/\./g, '').replace(',', '.').trim();
      return {
        doc: c[0]?.trim(),
        numBoleto: c[1]?.trim(),
        pagador: c[2]?.trim(),
        valor: parseFloat(valorStr)
      };
    }).filter(b => b.numBoleto);

    console.log(`   Arquivo: ${csvFev}`);
    console.log(`   Total de boletos: ${boletosFev.length}`);
    console.log(`   Valor total: R$ ${boletosFev.reduce((s, b) => s + (isNaN(b.valor) ? 0 : b.valor), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    // Verificar quantos já foram lançados
    let jaLancados = 0;
    let pendentes = [];
    
    for (const boleto of boletosFev) {
      const internalCode = `boleto_${boleto.numBoleto.replace(/\//g, '_')}_${boleto.doc}`;
      const existe = baixasExistentes?.find(b => b.internal_code === internalCode);
      if (existe) {
        jaLancados++;
      } else {
        pendentes.push(boleto);
      }
    }

    console.log(`\n   Já lançados: ${jaLancados}`);
    console.log(`   Pendentes: ${pendentes.length}`);

    if (pendentes.length > 0 && pendentes.length <= 20) {
      console.log('\n   Boletos pendentes:');
      pendentes.slice(0, 20).forEach(p => {
        console.log(`      ${p.doc} | ${p.numBoleto} | ${p.pagador?.substring(0, 30)} | R$ ${(p.valor || 0).toFixed(2)}`);
      });
    }
  } else {
    console.log(`   ❌ Arquivo não encontrado: ${csvFev}`);
  }

  // 5. RECOMENDAÇÃO DR. CÍCERO
  console.log('\n' + '═'.repeat(100));
  console.log('📋 PARECER DO DR. CÍCERO');
  console.log('═'.repeat(100));
  
  if (Math.abs(saldoT) < 0.01) {
    console.log('\n✅ SITUAÇÃO: Conta transitória ZERADA');
    console.log('   Todas as baixas de clientes foram realizadas corretamente.');
    console.log('   Nenhuma ação adicional necessária.\n');
  } else if (saldoT < -0.01) {
    console.log(`\n⚠️  SITUAÇÃO: Conta transitória com SALDO CREDOR de R$ ${Math.abs(saldoT).toFixed(2)}`);
    console.log('\n   DIAGNÓSTICO:');
    console.log('   Os recebimentos via banco (PIX/boletos) foram creditados na conta transitória,');
    console.log('   mas a baixa nos clientes individuais (D Transitória / C Cliente) ainda não foi feita.\n');
    console.log('   FLUXO CONTÁBIL CORRETO:');
    console.log('   1. Recebimento no banco:  D 1.1.1.05 (Banco) / C 1.1.9.01 (Transitória)');
    console.log('   2. Baixa no cliente:      D 1.1.9.01 (Transitória) / C 1.1.2.01.xxx (Cliente)\n');
    console.log('   AÇÃO RECOMENDADA:');
    console.log('   Executar o script de desmembramento para criar os lançamentos de baixa.');
    console.log('   Script: node scripts/mcp_desmembrar_cobrancas_jan2025.mjs\n');
  }

  console.log('═'.repeat(100));
}

main().catch(console.error);
