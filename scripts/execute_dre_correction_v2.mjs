/**
 * ============================================================================
 * CORREÇÃO DRE JANEIRO/2025 - VERSÃO SQL DIRETO
 * ============================================================================
 * Autorizado por: Dr. Cícero - 30/01/2026
 * 
 * Este script usa REST API com service_role para bypass de RLS
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

// Criar client com service_role (bypass RLS)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  }
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

async function main() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║     CORREÇÃO DRE JAN/2025 - AUTORIZADO POR DR. CÍCERO            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log('');

  // Buscar IDs das contas
  const { data: receitaAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '3.1.1.01')
    .eq('tenant_id', TENANT_ID)
    .single();

  const { data: transitoriaAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '2.1.9.01')
    .eq('tenant_id', TENANT_ID)
    .single();

  if (!receitaAccount || !transitoriaAccount) {
    console.error('❌ Contas não encontradas');
    return;
  }

  console.log('✅ Contas identificadas:');
  console.log(`   Receita: ${receitaAccount.id}`);
  console.log(`   Transitória: ${transitoriaAccount.id}`);

  // Buscar PIX classificados como receita
  const { data: pixEntries, error: pixError } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id, debit, credit, description, entry_id,
      accounting_entries!inner(id, entry_date, description, internal_code, source_type)
    `)
    .eq('account_id', receitaAccount.id)
    .eq('tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31')
    .like('accounting_entries.internal_code', 'PIX_CLASS%');

  if (pixError) {
    console.error('❌ Erro ao buscar PIX:', pixError.message);
    return;
  }

  console.log('');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('  ETAPA 1: ESTORNO DOS PIX CLASSIFICADOS COMO RECEITA');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log(`Encontrados ${pixEntries?.length || 0} lançamentos PIX em Receita`);

  let totalEstornado = 0;
  let estornosRealizados = 0;
  const auditLog = [];

  for (const pix of pixEntries || []) {
    const valor = Number(pix.credit || 0);
    if (valor <= 0) continue;

    totalEstornado += valor;
    const internalCode = `ESTORNO_${pix.accounting_entries.internal_code}_${Date.now()}`;

    console.log('');
    console.log(`🔄 Estornando: ${pix.accounting_entries.internal_code}`);
    console.log(`   Valor: R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Descrição: ${pix.accounting_entries.description}`);

    // Criar lançamento de estorno usando INSERT direto
    const entryId = crypto.randomUUID();
    
    const { error: entryError } = await supabase
      .from('accounting_entries')
      .insert({
        id: entryId,
        tenant_id: TENANT_ID,
        entry_date: '2025-01-31',
        competence_date: '2025-01-31',
        description: `ESTORNO DR. CÍCERO: ${pix.accounting_entries.description} - PIX não é receita (NBC TG 51)`,
        internal_code: internalCode,
        source_type: 'correction',
        entry_type: 'ESTORNO',
        reference_type: 'accounting_entry',
        reference_id: pix.entry_id,
        total_debit: valor,
        total_credit: valor,
        balanced: true
      });

    if (entryError) {
      console.log(`   ❌ Erro no cabeçalho: ${entryError.message}`);
      
      // Tentar via RPC se existir
      const { error: rpcError } = await supabase.rpc('create_correction_entry', {
        p_tenant_id: TENANT_ID,
        p_entry_date: '2025-01-31',
        p_description: `ESTORNO DR. CÍCERO: ${pix.accounting_entries.description}`,
        p_internal_code: internalCode,
        p_reference_id: pix.entry_id,
        p_debit_account_id: receitaAccount.id,
        p_credit_account_id: transitoriaAccount.id,
        p_amount: valor
      });

      if (rpcError) {
        console.log(`   ❌ RPC também falhou: ${rpcError.message}`);
        continue;
      }
    } else {
      // Inserir linhas
      const lineId1 = crypto.randomUUID();
      const lineId2 = crypto.randomUUID();

      const { error: line1Error } = await supabase
        .from('accounting_entry_lines')
        .insert({
          id: lineId1,
          tenant_id: TENANT_ID,
          entry_id: entryId,
          account_id: receitaAccount.id,
          debit: valor,
          credit: 0,
          description: 'Estorno receita indevida - PIX não gera receita (NBC TG 51)'
        });

      if (line1Error) {
        console.log(`   ❌ Erro linha débito: ${line1Error.message}`);
        continue;
      }

      const { error: line2Error } = await supabase
        .from('accounting_entry_lines')
        .insert({
          id: lineId2,
          tenant_id: TENANT_ID,
          entry_id: entryId,
          account_id: transitoriaAccount.id,
          debit: 0,
          credit: valor,
          description: 'Aguardando classificação correta'
        });

      if (line2Error) {
        console.log(`   ❌ Erro linha crédito: ${line2Error.message}`);
        continue;
      }
    }

    estornosRealizados++;
    console.log(`   ✅ Estorno criado: ${internalCode}`);

    auditLog.push({
      original_code: pix.accounting_entries.internal_code,
      estorno_code: internalCode,
      valor,
      timestamp: new Date().toISOString()
    });
  }

  // Calcular novo saldo
  const { data: novoSaldo } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit, accounting_entries!inner(entry_date)')
    .eq('account_id', receitaAccount.id)
    .eq('tenant_id', TENANT_ID)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  const totalCreditos = novoSaldo?.reduce((s, e) => s + Number(e.credit || 0), 0) || 0;
  const totalDebitos = novoSaldo?.reduce((s, e) => s + Number(e.debit || 0), 0) || 0;
  const saldoFinal = totalCreditos - totalDebitos;

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                    RELATÓRIO FINAL DE CORREÇÃO                    ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log('║                                                                   ║');
  console.log(`║  DRE ANTERIOR:         R$ 668.446,30                              ║`);
  console.log(`║  (-) PIX estornados:   R$ ${totalEstornado.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                              ║`);
  console.log('║  ─────────────────────────────────────────────────────────────────║');
  console.log(`║  DRE CORRIGIDA:        R$ ${saldoFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                              ║`);
  console.log(`║  VALOR ESPERADO:       R$ ${(136821.59).toLocaleString('pt-BR', { minimumFractionDigits: 2 }).padStart(12)}                              ║`);
  console.log('║                                                                   ║');
  console.log('╠═══════════════════════════════════════════════════════════════════╣');
  console.log(`║  ✅ Estornos realizados: ${estornosRealizados.toString().padStart(3)}                                      ║`);
  console.log('╚═══════════════════════════════════════════════════════════════════╝');

  // Salvar log
  fs.writeFileSync('_auditoria_correcao_dre_jan2025_final.json', JSON.stringify({
    data: new Date().toISOString(),
    autorizacao: 'Dr. Cícero - 30/01/2026',
    dre_anterior: 668446.30,
    total_estornado: totalEstornado,
    dre_final: saldoFinal,
    estornos: auditLog
  }, null, 2));

  console.log('');
  console.log('✅ Arquivo de auditoria salvo: _auditoria_correcao_dre_jan2025_final.json');
}

main().catch(console.error);
