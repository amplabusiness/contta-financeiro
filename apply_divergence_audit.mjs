/**
 * Script para criar a tabela divergence_audit_log
 * Executa via SQL direto no Supabase
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function applyMigration() {
  console.log("🔧 Criando tabela divergence_audit_log...\n");
  
  const sql = `
    -- Tabela de registro de divergências
    CREATE TABLE IF NOT EXISTS divergence_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id UUID NOT NULL REFERENCES tenants(id),
        
        -- Período da análise
        reference_month VARCHAR(7) NOT NULL,
        
        -- Valores no momento da análise
        operational_total DECIMAL(15,2) NOT NULL,
        accounting_total DECIMAL(15,2) NOT NULL,
        divergence_amount DECIMAL(15,2) NOT NULL,
        
        -- Detalhamento
        pending_invoices_count INTEGER DEFAULT 0,
        overdue_invoices_count INTEGER DEFAULT 0,
        opening_balance_amount DECIMAL(15,2) DEFAULT 0,
        
        -- Status do tratamento
        status VARCHAR(50) NOT NULL DEFAULT 'em_analise',
        
        -- Justificativa/Notas
        notes TEXT,
        resolution_notes TEXT,
        
        -- Auditoria
        analyzed_by UUID,
        analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        resolved_by UUID,
        resolved_at TIMESTAMP WITH TIME ZONE,
        
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        
        -- Constraints
        CONSTRAINT valid_status CHECK (status IN ('em_analise', 'justificado', 'em_correcao', 'resolvido')),
        CONSTRAINT positive_amounts CHECK (
            operational_total >= 0 AND 
            accounting_total >= 0 AND 
            divergence_amount >= 0
        )
    );
    
    -- Índices para consultas frequentes
    CREATE INDEX IF NOT EXISTS idx_divergence_audit_tenant 
        ON divergence_audit_log(tenant_id);
    
    CREATE INDEX IF NOT EXISTS idx_divergence_audit_month 
        ON divergence_audit_log(reference_month);
    
    CREATE INDEX IF NOT EXISTS idx_divergence_audit_status 
        ON divergence_audit_log(status);
    
    CREATE INDEX IF NOT EXISTS idx_divergence_audit_tenant_month 
        ON divergence_audit_log(tenant_id, reference_month);
  `;
  
  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
  
  if (error) {
    // Tentar método alternativo
    console.log("⚠️ RPC não disponível, tentando via REST API...\n");
    
    // Verificar se já existe
    const { data: check, error: checkError } = await supabase
      .from('divergence_audit_log')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log("✅ Tabela já existe!");
      return;
    }
    
    console.log("❌ Não foi possível criar via script.\n");
    console.log("Execute o SQL manualmente no Supabase Dashboard:\n");
    console.log("SQL Editor > New Query > Cole o conteúdo de:");
    console.log("supabase/migrations/20260131_divergence_audit_log.sql\n");
    return;
  }
  
  console.log("✅ Tabela criada com sucesso!");
}

// Método alternativo: tentar inserir e capturar erro
async function quickCreate() {
  console.log("🔧 Verificando/criando tabela divergence_audit_log...\n");
  
  // Tentar consultar
  const { error: queryError } = await supabase
    .from('divergence_audit_log')
    .select('id')
    .limit(1);
  
  if (!queryError) {
    console.log("✅ Tabela já existe e está acessível!");
    return true;
  }
  
  if (queryError.code === 'PGRST205') {
    console.log("⚠️ Tabela não existe no banco.\n");
    console.log("📋 INSTRUÇÕES PARA CRIAR:\n");
    console.log("1. Acesse: https://supabase.com/dashboard");
    console.log("2. Vá em: SQL Editor > New Query");
    console.log("3. Cole o conteúdo de: supabase/migrations/20260131_divergence_audit_log.sql");
    console.log("4. Clique em 'Run'\n");
    console.log("Ou execute via CLI: npx supabase db reset\n");
    return false;
  }
  
  console.log("Erro desconhecido:", queryError);
  return false;
}

quickCreate();
