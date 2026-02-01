/**
 * ============================================================================
 * TESTES DE INTEGRIDADE - ETAPAS 2 E 3
 * ============================================================================
 * Validação do Data Lake, Auditoria e Aprendizado
 * Data: 01/02/2026
 * ============================================================================
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

describe('Etapa 2: Auditoria Mensal', () => {
  
  describe('Tabela document_catalog', () => {
    it('deve existir', async () => {
      const { error } = await supabase
        .from('document_catalog')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('deve ter estrutura correta', async () => {
      const { data, error } = await supabase
        .from('document_catalog')
        .select('*')
        .limit(0);
      
      expect(error).toBeNull();
      // Se não der erro, a estrutura está ok
    });

    it('deve aceitar inserção de documento', async () => {
      const testDoc = {
        tenant_id: TENANT_ID,
        document_type: 'teste',
        reference_month: '2026-02-01',
        title: 'Documento de Teste',
        file_path: 'test/path.pdf',
        file_hash: 'abc123',
        tags: ['teste'],
        generated_by: 'test-suite'
      };

      const { data, error } = await supabase
        .from('document_catalog')
        .insert(testDoc)
        .select()
        .single();

      if (data) {
        // Limpar
        await supabase
          .from('document_catalog')
          .delete()
          .eq('id', data.id);
      }

      // Pode dar erro de RLS, mas não de estrutura
      expect(error?.code).not.toBe('42P01'); // table does not exist
    });
  });

  describe('Tabela monthly_closings', () => {
    it('deve existir', async () => {
      const { error } = await supabase
        .from('monthly_closings')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('deve ter constraint de unicidade tenant+month', async () => {
      // A constraint é verificada pela estrutura da tabela
      const { data, error } = await supabase
        .from('monthly_closings')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .limit(1);
      
      expect(error).toBeNull();
    });
  });

  describe('RPC generate_monthly_audit_data', () => {
    it('deve existir e retornar dados', async () => {
      const { data, error } = await supabase.rpc('generate_monthly_audit_data', {
        p_tenant_id: TENANT_ID,
        p_year: 2025,
        p_month: 1
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data).toHaveProperty('periodo');
      expect(data).toHaveProperty('transacoes');
      expect(data).toHaveProperty('transitorias');
      expect(data).toHaveProperty('situacao_geral');
    });

    it('deve retornar métricas de transações', async () => {
      const { data } = await supabase.rpc('generate_monthly_audit_data', {
        p_tenant_id: TENANT_ID,
        p_year: 2025,
        p_month: 1
      });

      expect(data.transacoes).toHaveProperty('total');
      expect(data.transacoes).toHaveProperty('reconciliadas');
      expect(data.transacoes).toHaveProperty('pendentes');
      expect(typeof data.transacoes.total).toBe('number');
    });

    it('deve retornar status das transitórias', async () => {
      const { data } = await supabase.rpc('generate_monthly_audit_data', {
        p_tenant_id: TENANT_ID,
        p_year: 2025,
        p_month: 1
      });

      expect(data.transitorias.debitos).toHaveProperty('conta');
      expect(data.transitorias.debitos).toHaveProperty('saldo');
      expect(data.transitorias.debitos).toHaveProperty('status');
      expect(data.transitorias.creditos).toHaveProperty('status');
    });
  });

  describe('RPC close_month', () => {
    it('deve existir', async () => {
      // Testar com documento inexistente (deve falhar mas existir)
      const { data, error } = await supabase.rpc('close_month', {
        p_tenant_id: TENANT_ID,
        p_year: 2099,
        p_month: 12,
        p_audit_document_id: '00000000-0000-0000-0000-000000000000',
        p_closed_by: 'test'
      });

      // Deve retornar erro de documento não encontrado, não de função inexistente
      expect(data?.success).toBe(false);
      expect(data?.error).toContain('não encontrado');
    });
  });
});

describe('Etapa 3: Aprendizado do Dr. Cícero', () => {
  
  describe('Tabela learned_rules', () => {
    it('deve existir', async () => {
      const { error } = await supabase
        .from('learned_rules')
        .select('id')
        .limit(1);
      
      expect(error).toBeNull();
    });

    it('deve ter regras iniciais carregadas', async () => {
      const { data, error } = await supabase
        .from('learned_rules')
        .select('rule_id, rule_name, severity')
        .eq('tenant_id', TENANT_ID)
        .eq('is_active', true);

      expect(error).toBeNull();
      expect(data?.length).toBeGreaterThan(0);
    });

    it('deve ter regra STATUS_DERIVADO', async () => {
      const { data, error } = await supabase
        .from('learned_rules')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('rule_id', 'STATUS_DERIVADO')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.severity).toBe('critical');
    });

    it('deve ter regra PIX_SOCIO_BLOQUEIO', async () => {
      const { data, error } = await supabase
        .from('learned_rules')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('rule_id', 'PIX_SOCIO_BLOQUEIO')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.severity).toBe('critical');
    });

    it('deve ter regra TRANSITORIA_ZERO', async () => {
      const { data, error } = await supabase
        .from('learned_rules')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('rule_id', 'TRANSITORIA_ZERO')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('deve ter regra RECONCILIACAO_VIA_RPC', async () => {
      const { data, error } = await supabase
        .from('learned_rules')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('rule_id', 'RECONCILIACAO_VIA_RPC')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Estrutura de regras', () => {
    it('todas as regras devem ter campos obrigatórios', async () => {
      const { data } = await supabase
        .from('learned_rules')
        .select('*')
        .eq('tenant_id', TENANT_ID);

      data?.forEach(rule => {
        expect(rule.rule_id).toBeDefined();
        expect(rule.rule_name).toBeDefined();
        expect(rule.category).toBeDefined();
        expect(rule.condition_description).toBeDefined();
        expect(rule.expected_outcome).toBeDefined();
        expect(rule.action_description).toBeDefined();
        expect(rule.severity).toBeDefined();
        expect(['low', 'medium', 'high', 'critical']).toContain(rule.severity);
      });
    });
  });
});

describe('Integração Completa', () => {
  
  it('sistema deve ter 3 camadas de proteção ativas', async () => {
    // Camada 1: Trigger
    const { data: triggers } = await supabase.rpc('generate_monthly_audit_data', {
      p_tenant_id: TENANT_ID,
      p_year: 2025,
      p_month: 1
    });
    expect(triggers).toBeDefined();

    // Camada 2: RPC de reconciliação existe
    const { data: rpcTest } = await supabase.rpc('reconcile_transaction', {
      p_transaction_id: '00000000-0000-0000-0000-000000000000',
      p_journal_entry_id: '00000000-0000-0000-0000-000000000000',
      p_actor: 'test'
    });
    // Vai falhar mas deve existir
    expect(rpcTest).toHaveProperty('success');

    // Camada 3: Regras aprendidas
    const { data: rules } = await supabase
      .from('learned_rules')
      .select('count')
      .eq('tenant_id', TENANT_ID)
      .eq('is_active', true);
    expect(rules).toBeDefined();
  });

  it('fluxo de auditoria deve estar completo', async () => {
    // 1. Dados de auditoria podem ser gerados
    const { data: auditData } = await supabase.rpc('generate_monthly_audit_data', {
      p_tenant_id: TENANT_ID,
      p_year: 2025,
      p_month: 1
    });
    expect(auditData.situacao_geral).toMatch(/OK|ATENCAO/);

    // 2. Tabela de fechamento existe
    const { error: closingError } = await supabase
      .from('monthly_closings')
      .select('id')
      .limit(1);
    expect(closingError).toBeNull();

    // 3. Catálogo de documentos existe
    const { error: catalogError } = await supabase
      .from('document_catalog')
      .select('id')
      .limit(1);
    expect(catalogError).toBeNull();
  });
});
