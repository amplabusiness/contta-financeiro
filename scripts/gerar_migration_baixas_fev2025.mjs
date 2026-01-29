// scripts/gerar_migration_baixas_fev2025.mjs
// Gera migration SQL para baixas de boletos de fevereiro 2025
// Dr. Cícero - Guardião Contábil MCP

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const CSV_PATH = 'banco/clientes de boleto fev.csv';

function parseValorBR(valor) {
  if (typeof valor === 'number') return valor;
  return parseFloat(valor.replace('R$', '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').trim());
}

function parseDataBR(data) {
  const [dia, mes, ano] = data.split('/');
  return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
}

function normalizarNome(nome) {
  return nome.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9 ]/g, '').trim();
}

async function main() {
  console.log('Gerando migration SQL para baixas de fevereiro 2025...\n');

  // Ler CSV
  const conteudo = readFileSync(CSV_PATH, 'latin1');
  const linhas = conteudo.split('\n').filter(l => l.trim()).slice(1);
  
  const boletos = linhas.map(l => {
    const c = l.split(';');
    return {
      documento: c[0]?.trim(),
      numBoleto: c[1]?.trim(),
      pagador: c[2]?.trim(),
      valorRecebido: parseValorBR(c[6]),
      dataExtrato: c[7]?.trim()
    };
  }).filter(b => b.numBoleto && !isNaN(b.valorRecebido) && b.valorRecebido > 0);

  console.log(`Total de boletos: ${boletos.length}`);

  // Buscar contas de clientes
  const { data: contasClientes } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '1.1.2.01.%')
    .neq('code', '1.1.2.01')
    .eq('tenant_id', TENANT_ID);

  // Verificar quais já existem
  const { data: existentes } = await supabase
    .from('accounting_entries')
    .select('internal_code')
    .ilike('internal_code', 'boleto_%')
    .eq('tenant_id', TENANT_ID);

  const existentesSet = new Set((existentes || []).map(e => e.internal_code));

  // Mapear pagador -> conta
  function buscarConta(pagador) {
    const nomeNorm = normalizarNome(pagador);
    const primeiraPalavra = nomeNorm.split(' ')[0];

    for (const conta of contasClientes || []) {
      const nomeContaNorm = normalizarNome(conta.name);
      if (nomeContaNorm === nomeNorm) return conta;
    }

    for (const conta of contasClientes || []) {
      const nomeContaNorm = normalizarNome(conta.name);
      if (nomeContaNorm.startsWith(primeiraPalavra) || nomeContaNorm.includes(nomeNorm.substring(0, 15))) {
        return conta;
      }
    }

    return null;
  }

  // Gerar SQL
  let sql = `-- supabase/migrations/20260128300000_baixas_boletos_fev2025.sql
-- Desmembramento de cobranças agrupadas - Fevereiro 2025 (Competência Janeiro 2025)
-- Dr. Cícero - Guardião Contábil MCP
-- Gerado em: ${new Date().toLocaleString('pt-BR')}

-- Desabilitar triggers temporariamente
SET session_replication_role = 'replica';

DO $$
DECLARE
  v_tenant_id uuid := '${TENANT_ID}';
  v_conta_transitoria_id uuid;
  v_entry_id uuid;
  v_conta_cliente_id uuid;
  v_count int := 0;
BEGIN
  -- Buscar conta transitória
  SELECT id INTO v_conta_transitoria_id 
  FROM chart_of_accounts 
  WHERE code = '1.1.9.01' AND tenant_id = v_tenant_id;

  RAISE NOTICE 'Conta Transitória: %', v_conta_transitoria_id;

`;

  let processados = 0;
  let jaExistem = 0;
  let semConta = 0;

  for (const boleto of boletos) {
    const internalCode = `boleto_${boleto.numBoleto.replace(/\//g, '_')}_${boleto.documento}`;
    
    if (existentesSet.has(internalCode)) {
      jaExistem++;
      continue;
    }

    const conta = buscarConta(boleto.pagador);
    if (!conta) {
      semConta++;
      console.log(`   ❌ Sem conta: ${boleto.pagador}`);
      continue;
    }

    const dataEntry = parseDataBR(boleto.dataExtrato);
    const descricao = `Recebimento boleto ${boleto.numBoleto} - ${boleto.pagador.substring(0, 30).replace(/'/g, "''")}`;

    sql += `
  -- ${boleto.pagador.substring(0, 40)} - R$ ${boleto.valorRecebido.toFixed(2)}
  IF NOT EXISTS (SELECT 1 FROM accounting_entries WHERE internal_code = '${internalCode}' AND tenant_id = v_tenant_id) THEN
    SELECT id INTO v_conta_cliente_id FROM chart_of_accounts WHERE code = '${conta.code}' AND tenant_id = v_tenant_id;
    IF v_conta_cliente_id IS NOT NULL THEN
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (v_tenant_id, '${dataEntry}', '2025-01-01', 'RECEBIMENTO_BOLETO', '${descricao}', '${internalCode}', ${boleto.valorRecebido.toFixed(2)}, ${boleto.valorRecebido.toFixed(2)}, true)
      RETURNING id INTO v_entry_id;
      INSERT INTO accounting_entry_items (tenant_id, entry_id, account_id, debit, credit, history) VALUES
        (v_tenant_id, v_entry_id, v_conta_transitoria_id, ${boleto.valorRecebido.toFixed(2)}, 0, 'Desmembramento ${boleto.documento}'),
        (v_tenant_id, v_entry_id, v_conta_cliente_id, 0, ${boleto.valorRecebido.toFixed(2)}, 'Recebimento boleto ${boleto.numBoleto}');
      v_count := v_count + 1;
    END IF;
  END IF;
`;
    processados++;
  }

  sql += `
  RAISE NOTICE 'Processados: % lançamentos', v_count;
END $$;

-- Reabilitar triggers
SET session_replication_role = 'origin';
`;

  // Salvar migration
  const migrationPath = 'supabase/migrations/20260128300000_baixas_boletos_fev2025.sql';
  writeFileSync(migrationPath, sql);

  console.log(`\n✅ Migration gerada: ${migrationPath}`);
  console.log(`   A processar: ${processados}`);
  console.log(`   Já existem: ${jaExistem}`);
  console.log(`   Sem conta: ${semConta}`);
  console.log(`\nPara aplicar, execute: npx supabase db push --include-all`);
}

main().catch(console.error);
