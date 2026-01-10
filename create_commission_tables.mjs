// create_commission_tables.mjs
// Cria as tabelas do sistema de comissões via Supabase REST API
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeSQL(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": SERVICE_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify({
      name: "exec_sql",
      args: { sql }
    })
  });
  return response;
}

async function createTables() {
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  console.log("=".repeat(70));
  console.log("CRIANDO TABELAS DO SISTEMA DE COMISSÕES");
  console.log("=".repeat(70));

  // Verificar se tabela já existe
  const { data, error } = await supabase
    .from("commission_agents")
    .select("id")
    .limit(1);

  if (!error) {
    console.log("✓ Tabela commission_agents já existe!");
    
    // Cadastrar Victor e Nayara
    await cadastrarAgentes(supabase);
    return;
  }

  if (error.code !== "42P01") {
    console.log("Erro inesperado:", error);
    return;
  }

  console.log("Tabelas não existem. Criando...");
  console.log("\n⚠ IMPORTANTE: Execute o SQL abaixo no Supabase Dashboard:\n");
  console.log("   https://supabase.com/dashboard/project/[seu-projeto]/sql/new\n");
  console.log("-".repeat(70));
  console.log(`
-- 1. TABELA DE AGENTES COMISSIONADOS
CREATE TABLE commission_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  cpf VARCHAR(14) UNIQUE,
  pix_key VARCHAR(100),
  pix_key_type VARCHAR(20) DEFAULT 'cpf',
  email VARCHAR(200),
  phone VARCHAR(20),
  bank_name VARCHAR(100),
  bank_agency VARCHAR(20),
  bank_account VARCHAR(30),
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA DE VÍNCULO CLIENTE-AGENTE
CREATE TABLE client_commission_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES commission_agents(id) ON DELETE CASCADE,
  percentage DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  is_active BOOLEAN DEFAULT true,
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, agent_id)
);

-- 3. TABELA DE COMISSÕES
CREATE TABLE agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES commission_agents(id),
  client_id UUID REFERENCES clients(id),
  source_type VARCHAR(50) NOT NULL,
  source_id UUID,
  source_description TEXT,
  client_payment_amount DECIMAL(15,2) NOT NULL,
  agent_percentage DECIMAL(5,2) NOT NULL,
  commission_amount DECIMAL(15,2) NOT NULL,
  competence VARCHAR(7),
  payment_date DATE,
  status VARCHAR(20) DEFAULT 'pending',
  paid_date DATE,
  paid_amount DECIMAL(15,2),
  payment_method VARCHAR(50),
  payment_reference VARCHAR(200),
  accounting_entry_id UUID REFERENCES accounting_entries(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_commission_agents_cpf ON commission_agents(cpf);
CREATE INDEX idx_client_commission_agents_client ON client_commission_agents(client_id);
CREATE INDEX idx_client_commission_agents_agent ON client_commission_agents(agent_id);
CREATE INDEX idx_agent_commissions_agent ON agent_commissions(agent_id);
CREATE INDEX idx_agent_commissions_status ON agent_commissions(status);

-- Habilitar RLS
ALTER TABLE commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_commission_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_commissions ENABLE ROW LEVEL SECURITY;

-- Políticas (permitir acesso com service_role)
CREATE POLICY "Enable all for service_role" ON commission_agents FOR ALL USING (true);
CREATE POLICY "Enable all for service_role" ON client_commission_agents FOR ALL USING (true);
CREATE POLICY "Enable all for service_role" ON agent_commissions FOR ALL USING (true);
`);
  console.log("-".repeat(70));
  console.log("\nApós executar o SQL, rode este script novamente.");
}

async function cadastrarAgentes(supabase) {
  console.log("\n" + "=".repeat(70));
  console.log("CADASTRANDO AGENTES");
  console.log("=".repeat(70));

  const agentes = [
    {
      name: "VICTOR HUGO LEÃO",
      cpf: "752.126.331-68",
      pix_key: "75212633168",
      pix_key_type: "cpf",
      notes: "Filho - recebe 50% dos honorários"
    },
    {
      name: "NAYARA CRISTINA LEÃO",
      cpf: "037.887.511-69", 
      pix_key: "03788751169",
      pix_key_type: "cpf",
      notes: "Filha - recebe 50% dos honorários"
    }
  ];

  for (const agente of agentes) {
    const { data: existing } = await supabase
      .from("commission_agents")
      .select("*")
      .eq("cpf", agente.cpf)
      .single();

    if (existing) {
      console.log(`✓ ${agente.name} já cadastrado`);
      console.log(`  ID: ${existing.id}`);
      console.log(`  PIX: ${existing.pix_key}`);
    } else {
      const { data, error } = await supabase
        .from("commission_agents")
        .insert(agente)
        .select()
        .single();

      if (error) {
        console.log(`✗ Erro ao cadastrar ${agente.name}:`, error.message);
      } else {
        console.log(`✓ ${agente.name} cadastrado com sucesso!`);
        console.log(`  ID: ${data.id}`);
      }
    }
  }

  // Listar todos os agentes
  console.log("\n" + "-".repeat(70));
  console.log("AGENTES CADASTRADOS:");
  console.log("-".repeat(70));
  
  const { data: all } = await supabase
    .from("commission_agents")
    .select("*")
    .order("name");

  if (all) {
    all.forEach((a, i) => {
      console.log(`\n${i + 1}. ${a.name}`);
      console.log(`   CPF: ${a.cpf}`);
      console.log(`   PIX: ${a.pix_key} (${a.pix_key_type})`);
      console.log(`   Status: ${a.is_active ? "Ativo" : "Inativo"}`);
    });
  }
}

createTables().catch(console.error);
