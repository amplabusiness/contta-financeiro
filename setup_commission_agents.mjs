// setup_commission_agents.mjs
// Script para criar tabelas e cadastrar Victor e Nayara
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function setupCommissionAgents() {
  console.log("=".repeat(70));
  console.log("SISTEMA DE COMISSÕES - SETUP");
  console.log("=".repeat(70));

  // 1. Verificar/Criar tabela commission_agents
  console.log("\n1. Verificando tabelas...");
  
  const { data: agents, error: agentsError } = await supabase
    .from("commission_agents")
    .select("id")
    .limit(1);

  if (agentsError && agentsError.code === "42P01") {
    console.log("   ⚠ Tabela commission_agents não existe.");
    console.log("   → Execute a migration SQL no Supabase Dashboard:");
    console.log("     supabase/migrations/20260109130001_create_commission_agents.sql");
    return;
  }

  console.log("   ✓ Tabela commission_agents existe");

  // 2. Cadastrar Victor e Nayara
  console.log("\n2. Cadastrando agentes...");

  const agentsToInsert = [
    {
      name: "VICTOR HUGO LEÃO",
      cpf: "752.126.331-68",
      pix_key: "75212633168",
      pix_key_type: "cpf",
      notes: "Filho - recebe 50% dos honorários de clientes vinculados"
    },
    {
      name: "NAYARA CRISTINA LEÃO", 
      cpf: "037.887.511-69",
      pix_key: "03788751169",
      pix_key_type: "cpf",
      notes: "Filha - recebe 50% dos honorários de clientes vinculados"
    }
  ];

  for (const agent of agentsToInsert) {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from("commission_agents")
      .select("id, name")
      .eq("cpf", agent.cpf)
      .single();

    if (existing) {
      console.log(`   ✓ ${agent.name} já cadastrado (ID: ${existing.id})`);
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from("commission_agents")
        .insert(agent)
        .select()
        .single();

      if (insertError) {
        console.log(`   ✗ Erro ao cadastrar ${agent.name}:`, insertError.message);
      } else {
        console.log(`   ✓ ${agent.name} cadastrado (ID: ${inserted.id})`);
      }
    }
  }

  // 3. Listar agentes cadastrados
  console.log("\n3. Agentes cadastrados:");
  const { data: allAgents } = await supabase
    .from("commission_agents")
    .select("*")
    .eq("is_active", true);

  if (allAgents) {
    allAgents.forEach(a => {
      console.log(`   - ${a.name}`);
      console.log(`     CPF: ${a.cpf}`);
      console.log(`     PIX: ${a.pix_key} (${a.pix_key_type})`);
      console.log(`     ID: ${a.id}`);
    });
  }

  // 4. Buscar clientes que aparecem na planilha Victor/Nayara
  console.log("\n4. Buscando clientes da planilha de dezembro...");
  
  // Clientes que aparecem na planilha (Victor)
  const clientesVictor = [
    "SOFTGAS SOLUÇÕES",
    "AGROSERRA",
    "COELHO E REZENDE", 
    "CIA DO IMOVEL",
    "PROMERCANTIL",
    "AMANCIO",
    "MENEZES - DSL",
    "JULLYANA",
    "SBS LIMPEZA"
  ];

  // Clientes que aparecem na planilha (Nayara)
  const clientesNayara = [
    "ODONTO HOUSE",
    "INOVE ODONTO",
    "STAFIN",
    "AGROPECUARIA SERRANO",
    "MINERAÇÃO SERRANO",
    "STAFIN HOTEL"
  ];

  console.log("\n   Clientes Victor Hugo (planilha):", clientesVictor.join(", "));
  console.log("   Clientes Nayara (planilha):", clientesNayara.join(", "));

  // 5. Verificar vínculo client_commission_agents
  const { data: links } = await supabase
    .from("client_commission_agents")
    .select("*, commission_agents(name), clients(name)")
    .eq("is_active", true);

  console.log("\n5. Vínculos cliente-agente cadastrados:", links?.length || 0);
  
  if (links && links.length > 0) {
    links.forEach(l => {
      console.log(`   - ${l.clients?.name} → ${l.commission_agents?.name} (${l.percentage}%)`);
    });
  }

  // 6. Verificar comissões pendentes
  const { data: commissions } = await supabase
    .from("agent_commissions")
    .select("*, commission_agents(name), clients(name)")
    .eq("status", "pending");

  console.log("\n6. Comissões pendentes:", commissions?.length || 0);
  
  if (commissions && commissions.length > 0) {
    let totalPending = 0;
    commissions.forEach(c => {
      console.log(`   - ${c.clients?.name}: R$ ${c.commission_amount?.toFixed(2)} → ${c.commission_agents?.name}`);
      totalPending += parseFloat(c.commission_amount || 0);
    });
    console.log(`   TOTAL PENDENTE: R$ ${totalPending.toFixed(2)}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("PRÓXIMOS PASSOS:");
  console.log("=".repeat(70));
  console.log("1. Vincular clientes aos agentes (client_commission_agents)");
  console.log("2. Configurar percentual de cada agente (padrão 50%)");
  console.log("3. Processar pagamentos e gerar comissões automaticamente");
  console.log("=".repeat(70));
}

setupCommissionAgents().catch(console.error);
