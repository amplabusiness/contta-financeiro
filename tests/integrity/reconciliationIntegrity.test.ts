/**
 * ============================================================================
 * TESTE DE INTEGRIDADE: Reconciliação Bancária
 * ============================================================================
 * Autor: Dr. Cícero - Contador Responsável
 * Data: 01/02/2026
 * 
 * 🎯 REGRA SOBERANA:
 * journal_entry_id != null → status DEVE ser 'reconciled'
 * 
 * Este teste impede regressão. Se alguém quebrar o fluxo → CI falha.
 * ============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

describe('🔒 Integridade de Reconciliação - Dr. Cícero', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Variáveis de ambiente VITE_SUPABASE_URL e VITE_SUPABASE_SERVICE_ROLE_KEY são obrigatórias');
    }
    
    supabase = createClient(url, key);
  });

  /**
   * 🔴 TESTE CRÍTICO #1
   * Não pode existir transação com lançamento contábil mas status = pending
   */
  it('não deve existir transação classificada (journal_entry_id) com status = pending', async () => {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, status, journal_entry_id, description, transaction_date')
      .eq('tenant_id', TENANT_ID)
      .not('journal_entry_id', 'is', null)
      .eq('status', 'pending');

    expect(error).toBeNull();
    
    if (data && data.length > 0) {
      console.error('❌ INCONSISTÊNCIAS ENCONTRADAS:');
      data.forEach(tx => {
        console.error(`  - ${tx.id} | ${tx.transaction_date} | ${tx.description?.slice(0, 50)}`);
      });
    }
    
    expect(data?.length).toBe(0);
  });

  /**
   * 🔴 TESTE CRÍTICO #2
   * Não pode existir transação com lançamento contábil mas is_reconciled = false
   */
  it('não deve existir transação classificada (journal_entry_id) com is_reconciled = false', async () => {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, is_reconciled, journal_entry_id')
      .eq('tenant_id', TENANT_ID)
      .not('journal_entry_id', 'is', null)
      .eq('is_reconciled', false);

    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  /**
   * 🟡 TESTE DE SANIDADE #3
   * Transações reconciliadas DEVEM ter reconciled_at preenchido
   */
  it('transações reconciliadas devem ter reconciled_at preenchido', async () => {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, status, reconciled_at')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'reconciled')
      .is('reconciled_at', null);

    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });

  /**
   * 🟢 TESTE POSITIVO #4
   * Todas as transações com journal_entry_id devem estar reconciliadas
   */
  it('todas as transações com journal_entry_id devem ter status = reconciled', async () => {
    const { data, error } = await supabase
      .from('bank_transactions')
      .select('id, status, journal_entry_id')
      .eq('tenant_id', TENANT_ID)
      .not('journal_entry_id', 'is', null);

    expect(error).toBeNull();
    
    const inconsistentes = data?.filter(tx => tx.status !== 'reconciled') || [];
    expect(inconsistentes.length).toBe(0);
  });

  /**
   * 🔵 TESTE DE MÉTRICAS #5
   * Relatório de situação atual (informativo)
   */
  it('deve gerar métricas de reconciliação', async () => {
    const { data: reconciliadas } = await supabase
      .from('bank_transactions')
      .select('id', { count: 'exact' })
      .eq('tenant_id', TENANT_ID)
      .not('journal_entry_id', 'is', null);

    const { data: pendentes } = await supabase
      .from('bank_transactions')
      .select('id', { count: 'exact' })
      .eq('tenant_id', TENANT_ID)
      .is('journal_entry_id', null);

    console.log('\n📊 MÉTRICAS DE RECONCILIAÇÃO:');
    console.log(`  ✅ Classificadas: ${reconciliadas?.length || 0}`);
    console.log(`  ⏳ Pendentes: ${pendentes?.length || 0}`);
    console.log(`  📈 Total: ${(reconciliadas?.length || 0) + (pendentes?.length || 0)}`);
    
    // Este teste sempre passa - é apenas informativo
    expect(true).toBe(true);
  });
});

/**
 * ============================================================================
 * TESTES DE RPC - reconcile_transaction()
 * ============================================================================
 */
describe('📡 RPC reconcile_transaction - Dr. Cícero', () => {
  let supabase: SupabaseClient;

  beforeAll(() => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Variáveis de ambiente obrigatórias');
    }
    
    supabase = createClient(url, key);
  });

  /**
   * 🔴 TESTE: RPC deve existir
   */
  it('RPC reconcile_transaction deve estar disponível', async () => {
    // Tentar chamar com UUID inválido para verificar se função existe
    const { error } = await supabase.rpc('reconcile_transaction', {
      p_transaction_id: '00000000-0000-0000-0000-000000000000',
      p_journal_entry_id: '00000000-0000-0000-0000-000000000000',
      p_actor: 'test'
    });

    // Se o erro for "Transação não encontrada", o RPC existe
    // Se for outro erro (função não existe), o teste falha
    if (error) {
      expect(error.message).toContain('não encontrada');
    }
  });

  /**
   * 🔴 TESTE: RPC unreconcile_transaction deve existir
   */
  it('RPC unreconcile_transaction deve estar disponível', async () => {
    const { error } = await supabase.rpc('unreconcile_transaction', {
      p_transaction_id: '00000000-0000-0000-0000-000000000000',
      p_actor: 'test',
      p_reason: 'teste'
    });

    if (error) {
      expect(error.message).toContain('não encontrada');
    }
  });
});

/**
 * ============================================================================
 * TESTES DE TRANSITÓRIAS - Regra Dr. Cícero
 * ============================================================================
 */
describe('🏦 Integridade das Transitórias - Dr. Cícero', () => {
  let supabase: SupabaseClient;

  const TRANSITORIA_DEBITOS_ID = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
  const TRANSITORIA_CREDITOS_ID = '28085461-9e5a-4fb4-847d-c9fc047fe0a1';

  beforeAll(() => {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    
    if (!url || !key) {
      throw new Error('Variáveis de ambiente obrigatórias');
    }
    
    supabase = createClient(url, key);
  });

  /**
   * 🔴 REGRA DE OURO: Transitórias devem tender a zero
   */
  it('saldo da transitória de débitos deve estar controlado', async () => {
    const { data, error } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('tenant_id', TENANT_ID)
      .eq('account_id', TRANSITORIA_DEBITOS_ID);

    expect(error).toBeNull();
    
    const totalDebito = data?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
    const totalCredito = data?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;
    const saldo = totalDebito - totalCredito;
    
    console.log(`\n📋 Transitória DÉBITOS (1.1.9.01):`);
    console.log(`  Débitos: R$ ${totalDebito.toFixed(2)}`);
    console.log(`  Créditos: R$ ${totalCredito.toFixed(2)}`);
    console.log(`  Saldo: R$ ${saldo.toFixed(2)}`);
    
    // Informativo - não falha, mas alerta
    if (Math.abs(saldo) > 0.01) {
      console.warn(`  ⚠️ ATENÇÃO: Há pendências de classificação!`);
    } else {
      console.log(`  ✅ OK - Transitória zerada`);
    }
  });

  it('saldo da transitória de créditos deve estar controlado', async () => {
    const { data, error } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('tenant_id', TENANT_ID)
      .eq('account_id', TRANSITORIA_CREDITOS_ID);

    expect(error).toBeNull();
    
    const totalDebito = data?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
    const totalCredito = data?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;
    const saldo = totalCredito - totalDebito; // Natureza credora
    
    console.log(`\n📋 Transitória CRÉDITOS (2.1.9.01):`);
    console.log(`  Débitos: R$ ${totalDebito.toFixed(2)}`);
    console.log(`  Créditos: R$ ${totalCredito.toFixed(2)}`);
    console.log(`  Saldo: R$ ${saldo.toFixed(2)}`);
    
    if (Math.abs(saldo) > 0.01) {
      console.warn(`  ⚠️ ATENÇÃO: Há pendências de classificação!`);
    } else {
      console.log(`  ✅ OK - Transitória zerada`);
    }
  });
});
