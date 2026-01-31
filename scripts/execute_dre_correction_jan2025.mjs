/**
 * ============================================================================
 * CORREÇÃO DRE JANEIRO/2025 - AUTORIZADO POR DR. CÍCERO
 * ============================================================================
 * 
 * Data: 30/01/2026
 * Autorização: Parecer Técnico Dr. Cícero
 * 
 * CORREÇÕES APROVADAS:
 * ✅ Estorno dos PIX indevidamente classificados como Receita
 * ✅ Eliminação de lançamentos duplicados (REPROC_HON_*)
 * ✅ Recálculo da DRE Janeiro/2025
 * 
 * REGRAS APLICADAS:
 * 🔴 PIX NUNCA gera receita automaticamente
 * 🔴 REPROC substitui, nunca soma
 * 🔴 Receita SÓ nasce de honorários/contratos
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// Contas importantes
const CONTAS = {
  RECEITA_HONORARIOS: '3.1.1.01',
  CLIENTES_A_RECEBER: '1.1.2.01',
  TRANSITORIA_CREDITOS: '2.1.9.01',
  BANCO_SICREDI: '1.1.1.05'
};

// Log de auditoria
const auditLog = {
  data_execucao: new Date().toISOString(),
  autorizacao: 'PARECER TÉCNICO DR. CÍCERO - 30/01/2026',
  acoes: []
};

function log(msg, data = null) {
  const entry = { timestamp: new Date().toISOString(), msg, data };
  auditLog.acoes.push(entry);
  console.log(`[${entry.timestamp.split('T')[1].split('.')[0]}] ${msg}`);
  if (data) console.log('   ', JSON.stringify(data, null, 2).substring(0, 200));
}

async function getAccountId(code) {
  const { data } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', code)
    .eq('tenant_id', TENANT_ID)
    .single();
  return data?.id;
}

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║     CORREÇÃO DRE JAN/2025 - AUTORIZADO POR DR. CÍCERO            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Buscar IDs das contas
  const receitaAccountId = await getAccountId(CONTAS.RECEITA_HONORARIOS);
  const transitoriaId = await getAccountId(CONTAS.TRANSITORIA_CREDITOS);
  const clientesId = await getAccountId(CONTAS.CLIENTES_A_RECEBER);

  if (!receitaAccountId) {
    log('❌ ERRO: Conta de Receita não encontrada');
    return;
  }

  log('✅ Contas identificadas', {
    receita: receitaAccountId,
    transitoria: transitoriaId
  });

  // =========================================================================
  // ETAPA 1: Identificar PIX classificados como Receita
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  ETAPA 1: ESTORNO DOS PIX CLASSIFICADOS COMO RECEITA');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Buscar lançamentos PIX_CLASS na conta de Receita
  const { data: pixEntries } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit, description, entry_id,
      accounting_entries!inner(id, entry_date, description, internal_code, source_type)
    `)
    .eq('account_id', receitaAccountId)
    .eq('tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31')
    .like('accounting_entries.internal_code', 'PIX_CLASS%');

  log(`Encontrados ${pixEntries?.length || 0} lançamentos PIX em Receita`);

  let totalEstornoPix = 0;
  const pixEstornados = [];

  if (pixEntries?.length > 0) {
    for (const pix of pixEntries) {
      const valor = Number(pix.credit || 0);
      totalEstornoPix += valor;

      log(`🔄 Estornando PIX: ${pix.accounting_entries.internal_code}`, {
        valor,
        descricao: pix.accounting_entries.description
      });

      // Criar lançamento de ESTORNO
      const internalCode = `ESTORNO_${pix.accounting_entries.internal_code}_${Date.now()}`;
      
      const { data: estornoEntry, error: estornoError } = await supabase
        .from('accounting_entries')
        .insert({
          tenant_id: TENANT_ID,
          entry_date: '2025-01-31', // Último dia do mês
          competence_date: '2025-01-31', // Data de competência
          description: `ESTORNO AUTORIZADO DR. CÍCERO: ${pix.accounting_entries.description} - PIX não é receita`,
          internal_code: internalCode,
          source_type: 'correction',
          entry_type: 'ESTORNO',
          reference_type: 'accounting_entry',
          reference_id: pix.entry_id,
          total_debit: valor,
          total_credit: valor,
          balanced: true
        })
        .select()
        .single();

      if (estornoError) {
        log(`❌ Erro ao criar estorno: ${estornoError.message}`);
        continue;
      }

      // Linha 1: Débito em Receita (estorna o crédito original)
      await supabase.from('accounting_entry_lines').insert({
        tenant_id: TENANT_ID,
        entry_id: estornoEntry.id,
        account_id: receitaAccountId,
        debit: valor,
        credit: 0,
        description: 'Estorno receita indevida - PIX não gera receita (NBC TG 51)'
      });

      // Linha 2: Crédito na Transitória (aguarda reclassificação correta)
      await supabase.from('accounting_entry_lines').insert({
        tenant_id: TENANT_ID,
        entry_id: estornoEntry.id,
        account_id: transitoriaId,
        debit: 0,
        credit: valor,
        description: 'Aguardando classificação correta - baixa de cliente ou aporte'
      });

      pixEstornados.push({
        original_entry_id: pix.entry_id,
        estorno_entry_id: estornoEntry.id,
        valor,
        internal_code: pix.accounting_entries.internal_code
      });

      log(`✅ Estorno criado: ${internalCode}`);
    }
  }

  log(`📊 Total estornado de PIX: R$ ${totalEstornoPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // =========================================================================
  // ETAPA 2: Identificar e remover REPROC duplicados
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  ETAPA 2: ELIMINAR LANÇAMENTOS DUPLICADOS (REPROC_HON_*)');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Buscar lançamentos REPROC_HON na conta de Receita
  const { data: reprocEntries } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit, description, entry_id,
      accounting_entries!inner(id, entry_date, description, internal_code, source_type)
    `)
    .eq('account_id', receitaAccountId)
    .eq('tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31')
    .like('accounting_entries.internal_code', 'REPROC_HON_%');

  log(`Encontrados ${reprocEntries?.length || 0} lançamentos REPROC_HON`);

  let totalReprocEstornado = 0;
  const reprocEstornados = [];

  if (reprocEntries?.length > 0) {
    for (const reproc of reprocEntries) {
      const valor = Number(reproc.credit || 0);
      
      // Verificar se existe o lançamento original (sem REPROC)
      const originalCode = reproc.accounting_entries.internal_code.replace('REPROC_HON_', 'hon_');
      
      const { data: original } = await supabase
        .from('accounting_entries')
        .select('id, internal_code')
        .eq('tenant_id', TENANT_ID)
        .eq('internal_code', originalCode)
        .single();

      // Se existe o original, o REPROC é duplicado e deve ser estornado
      if (original) {
        totalReprocEstornado += valor;

        log(`🔄 Estornando duplicado: ${reproc.accounting_entries.internal_code}`, {
          valor,
          original_code: originalCode
        });

        // Criar lançamento de ESTORNO
        const internalCode = `ESTORNO_DUP_${reproc.accounting_entries.internal_code}_${Date.now()}`;
        
        const { data: estornoEntry, error: estornoError } = await supabase
          .from('accounting_entries')
          .insert({
            tenant_id: TENANT_ID,
            entry_date: '2025-01-31',
            competence_date: '2025-01-31',
            description: `ESTORNO DUPLICIDADE DR. CÍCERO: ${reproc.accounting_entries.description}`,
            internal_code: internalCode,
            source_type: 'correction',
            entry_type: 'ESTORNO_DUPLICIDADE',
            reference_type: 'accounting_entry',
            reference_id: reproc.entry_id,
            total_debit: valor,
            total_credit: valor,
            balanced: true
          })
          .select()
          .single();

        if (estornoError) {
          log(`❌ Erro ao criar estorno: ${estornoError.message}`);
          continue;
        }

        // Linha 1: Débito em Receita (estorna o crédito duplicado)
        await supabase.from('accounting_entry_lines').insert({
          tenant_id: TENANT_ID,
          entry_id: estornoEntry.id,
          account_id: receitaAccountId,
          debit: valor,
          credit: 0,
          description: 'Estorno duplicidade - REPROC substitui, não soma'
        });

        // Linha 2: Crédito em Clientes (reconstitui a duplicata)
        // Isso é necessário pois o REPROC também baixou a duplicata
        const { data: clienteAccount } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('tenant_id', TENANT_ID)
          .like('code', '1.1.2%')
          .eq('is_analytical', true)
          .limit(1)
          .single();

        if (clienteAccount) {
          await supabase.from('accounting_entry_lines').insert({
            tenant_id: TENANT_ID,
            entry_id: estornoEntry.id,
            account_id: clienteAccount.id,
            debit: 0,
            credit: valor,
            description: 'Reconstituição duplicata - correção de duplicidade'
          });
        }

        reprocEstornados.push({
          original_entry_id: reproc.entry_id,
          estorno_entry_id: estornoEntry.id,
          valor,
          internal_code: reproc.accounting_entries.internal_code,
          had_original: true
        });

        log(`✅ Duplicado estornado: ${internalCode}`);
      } else {
        log(`ℹ️ REPROC sem original (mantido): ${reproc.accounting_entries.internal_code}`);
      }
    }
  }

  log(`📊 Total estornado de duplicados: R$ ${totalReprocEstornado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // =========================================================================
  // ETAPA 3: Recalcular valores
  // =========================================================================
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  ETAPA 3: RECALCULAR DRE JANEIRO/2025');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // Buscar novo total de receita
  const { data: novaReceitaEntries } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit,
      accounting_entries!inner(entry_date)
    `)
    .eq('account_id', receitaAccountId)
    .eq('tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  const totalCreditos = novaReceitaEntries?.reduce((sum, e) => sum + Number(e.credit || 0), 0) || 0;
  const totalDebitos = novaReceitaEntries?.reduce((sum, e) => sum + Number(e.debit || 0), 0) || 0;
  const saldoReceita = totalCreditos - totalDebitos;

  // =========================================================================
  // RELATÓRIO FINAL
  // =========================================================================
  console.log('\n');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                    RELATÓRIO FINAL DE CORREÇÃO                    ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                   ║');
  console.log(`║  DRE ANTERIOR:         R$ 668.446,30                              ║`);
  console.log(`║  (-) PIX estornados:   R$ ${totalEstornoPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                              ║`);
  console.log(`║  (-) Duplicados:       R$ ${totalReprocEstornado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                              ║`);
  console.log('║  ─────────────────────────────────────────────────────────────────║');
  console.log(`║  DRE CORRIGIDA:        R$ ${saldoReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                              ║`);
  console.log(`║  VALOR ESPERADO:       R$ ${(136821.59).toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                              ║`);
  console.log('║                                                                   ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log('║  ✅ PIX estornados: ' + pixEstornados.length.toString().padStart(3) + '                                            ║');
  console.log('║  ✅ Duplicados estornados: ' + reprocEstornados.length.toString().padStart(3) + '                                       ║');
  console.log('║  ✅ Trilha de auditoria mantida                                   ║');
  console.log('║  ✅ Saldo bancário preservado                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  // Salvar log de auditoria
  auditLog.resumo = {
    dre_anterior: 668446.30,
    pix_estornados: totalEstornoPix,
    duplicados_estornados: totalReprocEstornado,
    dre_corrigida: saldoReceita,
    valor_esperado: 136821.59,
    qtd_pix_estornados: pixEstornados.length,
    qtd_duplicados_estornados: reprocEstornados.length
  };
  auditLog.detalhes = {
    pix: pixEstornados,
    duplicados: reprocEstornados
  };

  fs.writeFileSync(
    '_auditoria_correcao_dre_jan2025.json',
    JSON.stringify(auditLog, null, 2)
  );

  console.log('\n✅ Arquivo de auditoria salvo: _auditoria_correcao_dre_jan2025.json');
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log('  CORREÇÃO CONCLUÍDA - AUTORIZADO POR DR. CÍCERO');
  console.log('═══════════════════════════════════════════════════════════════════\n');
}

main().catch(console.error);
