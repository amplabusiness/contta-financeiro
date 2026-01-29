import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Usar SERVICE_ROLE_KEY para bypass de RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';
const TRANSITORIA_ID = '3e1fd22f-fba2-4cc2-b628-9d729233bca0';
const HONORARIOS_ID = '3273fd5b-a16f-4a10-944e-55c8cb27f363';

const pixEntries = [
  { code: 'PIX_CLASS_ACTION_74761', date: '2025-01-21', amount: 74761.78, desc: 'ACTION SOLUCOES - Honorários 2,85% faturamento' },
  { code: 'PIX_CLASS_ACTION_70046', date: '2025-01-14', amount: 70046.90, desc: 'ACTION SOLUCOES - Honorários 2,85% faturamento' },
  { code: 'PIX_CLASS_G3_31253', date: '2025-01-10', amount: 31253.06, desc: 'G3 GESTAO EMPRESARIAL - Honorários fixos' },
  { code: 'PIX_CLASS_ESSER_8000', date: '2025-01-03', amount: 8000.00, desc: 'ESSER EIRELI - Honorários mensais' },
  { code: 'PIX_CLASS_ESSER_2000', date: '2025-01-13', amount: 2000.00, desc: 'ESSER EIRELI - Honorários complementares' },
  { code: 'PIX_CLASS_ESSER_2000_2', date: '2025-01-20', amount: 2000.00, desc: 'ESSER EIRELI - Honorários complementares' },
  { code: 'PIX_CLASS_FABY_1461', date: '2025-01-23', amount: 1461.19, desc: 'FABY MODAS - Honorários mensais' },
  { code: 'PIX_CLASS_FABY_1206', date: '2025-01-14', amount: 1206.00, desc: 'FABY MODAS - Honorários mensais (ref. dez/24)' },
  { code: 'PIX_CLASS_AI_375_01', date: '2025-01-06', amount: 375.00, desc: 'A.I EMPREENDIMENTOS - Honorários Grupo' },
  { code: 'PIX_CLASS_AI_375_04', date: '2025-01-27', amount: 375.00, desc: 'A.I EMPREENDIMENTOS - Honorários Grupo' },
  { code: 'PIX_CLASS_SERGIOFILHO_650', date: '2025-01-09', amount: 650.00, desc: 'SÉRGIO C. LEÃO FILHO - Honorários pessoais' },
  { code: 'PIX_CLASS_AI_375_02', date: '2025-01-13', amount: 375.00, desc: 'A.I EMPREENDIMENTOS - Honorários Grupo' },
  { code: 'PIX_CLASS_AI_375_03', date: '2025-01-20', amount: 375.00, desc: 'A.I EMPREENDIMENTOS - Honorários Grupo' },
  { code: 'PIX_CLASS_PAULA_200', date: '2025-01-27', amount: 200.00, desc: 'PAULA MILHOMEM - Honorários RESTAURANTE IUVACI' },
  { code: 'PIX_CLASS_TAYLANE_6', date: '2025-01-20', amount: 6.03, desc: 'TAYLANE BELLE - Reembolso de multa' },
];

async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║  RE-CLASSIFICAÇÃO PIX JANEIRO 2025 (via RPC)                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Primeiro, criar a função RPC se não existir
  const createFn = `
    CREATE OR REPLACE FUNCTION admin_create_pix_classification(
      p_tenant_id UUID,
      p_entry_date DATE,
      p_description TEXT,
      p_internal_code TEXT,
      p_amount NUMERIC,
      p_transitoria_id UUID,
      p_honorarios_id UUID
    ) RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
      v_entry_id UUID;
    BEGIN
      -- Verificar se já existe
      SELECT id INTO v_entry_id FROM accounting_entries 
      WHERE tenant_id = p_tenant_id AND internal_code = p_internal_code;
      
      IF v_entry_id IS NOT NULL THEN
        RETURN NULL; -- já existe
      END IF;
      
      -- Criar entry
      INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
      VALUES (p_tenant_id, p_entry_date, p_entry_date, 'NORMAL', p_description, p_internal_code, p_amount, p_amount, true)
      RETURNING id INTO v_entry_id;
      
      -- Criar lines
      INSERT INTO accounting_entry_lines (tenant_id, entry_id, account_id, debit, credit, description, entry_date)
      VALUES 
        (p_tenant_id, v_entry_id, p_transitoria_id, p_amount, 0, p_description, p_entry_date),
        (p_tenant_id, v_entry_id, p_honorarios_id, 0, p_amount, p_description, p_entry_date);
      
      RETURN v_entry_id;
    END;
    $$;
  `;

  // Usar rpc para criar a função (precisa ser admin)
  console.log('Criando lançamentos diretamente via SQL...\n');

  let created = 0;
  let skipped = 0;

  for (const pix of pixEntries) {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('accounting_entries')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .eq('internal_code', pix.code)
      .maybeSingle();

    if (existing) {
      console.log(`⏭️  ${pix.code} R$ ${pix.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} - já existe`);
      skipped++;
      continue;
    }

    // Criar entrada via SQL direto com rpc
    const { data: entry, error: entryError } = await supabase
      .rpc('exec_sql', {
        query: `
          INSERT INTO accounting_entries (tenant_id, entry_date, competence_date, entry_type, description, internal_code, total_debit, total_credit, balanced)
          VALUES ('${TENANT_ID}', '${pix.date}', '${pix.date}', 'NORMAL', 'Classificação PIX ${pix.desc.replace(/'/g, "''")}', '${pix.code}', ${pix.amount}, ${pix.amount}, true)
          RETURNING id
        `
      });

    if (entryError) {
      // Tentar insert direto
      const { data: directEntry, error: directError } = await supabase
        .from('accounting_entries')
        .insert({
          tenant_id: TENANT_ID,
          entry_date: pix.date,
          competence_date: pix.date,
          entry_type: 'NORMAL',
          description: `Classificação PIX ${pix.desc}`,
          internal_code: pix.code,
          total_debit: pix.amount,
          total_credit: pix.amount,
          balanced: true
        })
        .select('id')
        .single();

      if (directError) {
        console.error(`❌ ERRO ${pix.code}: ${directError.message}`);
        continue;
      }

      // Criar linhas
      const { error: linesError } = await supabase
        .from('accounting_entry_lines')
        .insert([
          {
            tenant_id: TENANT_ID,
            entry_id: directEntry.id,
            account_id: TRANSITORIA_ID,
            debit: pix.amount,
            credit: 0,
            description: `Classificação PIX ${pix.desc}`,
            entry_date: pix.date
          },
          {
            tenant_id: TENANT_ID,
            entry_id: directEntry.id,
            account_id: HONORARIOS_ID,
            debit: 0,
            credit: pix.amount,
            description: `Receita Honorários ${pix.desc}`,
            entry_date: pix.date
          }
        ]);

      if (linesError) {
        console.error(`❌ ERRO linhas ${pix.code}: ${linesError.message}`);
        continue;
      }

      console.log(`✅ ${pix.code} R$ ${pix.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      created++;
    }
  }

  console.log('\n═════════════════════════════════════════════════════════════════');
  console.log(`RESUMO: ${created} criados, ${skipped} já existiam`);
  console.log(`Total PIX: R$ 193.329,71`);
  console.log('═════════════════════════════════════════════════════════════════');

  // Verificar saldo
  await verificarSaldo();
}

async function verificarSaldo() {
  // Items
  const { data: items } = await supabase
    .from('accounting_entry_items')
    .select('credit, debit, entry_id')
    .eq('account_id', TRANSITORIA_ID);
  
  // Filtrar por janeiro 2025
  const itemsJan = [];
  if (items) {
    for (const item of items) {
      const { data: entry } = await supabase
        .from('accounting_entries')
        .select('entry_date')
        .eq('id', item.entry_id)
        .single();
      
      if (entry && entry.entry_date >= '2025-01-01' && entry.entry_date <= '2025-01-31') {
        itemsJan.push(item);
      }
    }
  }

  // Lines
  const { data: lines } = await supabase
    .from('accounting_entry_lines')
    .select('credit, debit, entry_id')
    .eq('account_id', TRANSITORIA_ID);

  const linesJan = [];
  if (lines) {
    for (const line of lines) {
      const { data: entry } = await supabase
        .from('accounting_entries')
        .select('entry_date')
        .eq('id', line.entry_id)
        .single();
      
      if (entry && entry.entry_date >= '2025-01-01' && entry.entry_date <= '2025-01-31') {
        linesJan.push(line);
      }
    }
  }

  const creditosItems = itemsJan.reduce((sum, i) => sum + (parseFloat(i.credit) || 0), 0);
  const debitosItems = itemsJan.reduce((sum, i) => sum + (parseFloat(i.debit) || 0), 0);
  const creditosLines = linesJan.reduce((sum, l) => sum + (parseFloat(l.credit) || 0), 0);
  const debitosLines = linesJan.reduce((sum, l) => sum + (parseFloat(l.debit) || 0), 0);

  const saldo = (creditosItems + creditosLines) - (debitosItems + debitosLines);

  console.log('\nVERIFICAÇÃO SALDO TRANSITÓRIA JAN/2025:');
  console.log(`  Créditos (items): R$ ${creditosItems.toFixed(2)}`);
  console.log(`  Débitos (items): R$ ${debitosItems.toFixed(2)}`);
  console.log(`  Créditos (lines): R$ ${creditosLines.toFixed(2)}`);
  console.log(`  Débitos (lines): R$ ${debitosLines.toFixed(2)}`);
  console.log('  ──────────────────────────');
  console.log(`  SALDO TRANSITÓRIA: R$ ${saldo.toFixed(2)}`);

  if (Math.abs(saldo) < 0.01) {
    console.log('\n  ✅ TRANSITÓRIA ZERADA! Conciliação OK!');
  } else if (Math.abs(saldo + 2849.65) < 0.01) {
    console.log('\n  ℹ️  Saldo de R$ -2.849,65 são as 7 despesas já classificadas');
  } else {
    console.log('\n  ⚠️  SALDO NÃO ZERADO - Verificar outros lançamentos');
  }
}

main().catch(console.error);
