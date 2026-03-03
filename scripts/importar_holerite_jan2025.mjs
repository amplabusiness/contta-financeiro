/**
 * Importação automática da Folha de Pagamento — Janeiro/2025
 * Fonte: folha_pgto/FOLHA AMPLA JAN.pdf (Dominio Sistemas)
 *
 * Dados extraídos do PDF (rodapé de cada holerite):
 *   Nome | CC | Cargo | TotalVencimentos | TotalDescontos | Líquido | FGTS | Sal.Contr.INSS
 *
 * Regras de classificação contábil:
 *   CC CUSTOS OPERACIONAIS  → D: 4.1.1.01 Salários     | C: 1.1.1.05 Banco
 *   CC DESPESAS ADMINIST.   → depende do funcionário:
 *     Babá (Fabiana)        → D: 1.1.3.04.04 Adiant.Nayara | C: 1.1.1.05 Banco
 *     Caseiro (Raimundo)    → D: 1.1.3.04.01 Adiant.Sérgio | C: 1.1.1.05 Banco
 *     Sérgio Augusto        → D: 1.1.3.04.05 Adiant.S.Aug  | C: 1.1.1.05 Banco
 */

import { supabase, TENANT_ID } from '../lib/supabase.mjs';

const COMPETENCIA = '01/2025';
const MES_ANO    = '012025';
const ENTRY_DATE = '2025-01-31';   // último dia do mês

// ── Dados extraídos do PDF ────────────────────────────────────────────────────
// ATENÇÃO: DEUZA = rescisão com líquido R$0,00 → importada com observação
// RAIMUNDO (Caseiro) e SÉRGIO AUGUSTO → adiantamentos, não despesa operacional

const HOLERITES = [
  {
    nome:            'DEUZA RESENDE DE JESUS',
    cargo:           'ANALISTA DE DEPARTAMENTO PESSOAL',
    cc_dominio:      'CUSTOS OPERACIONAIS',
    cc_contabil:     'CUSTOS_OPERACIONAIS',
    totalVencimentos: 7590.00,
    totalDescontos:   7590.00,
    valorLiquido:     0.00,       // Rescisão — saldo zero
    fgtsMes:          0.00,
    salContrInss:     3190.00,
    obs:             'RESCISÃO — liquido zero, verbas rescinsorias compensadas',
    debitCode:       '4.1.1.01',  // Salários
  },
  {
    nome:            'FABIANA MARIA DA SILVA MENDONCA',
    cargo:           'BABA',
    cc_dominio:      'DESPESAS ADMINISTRATIVAS',
    cc_contabil:     'ADIANTAMENTO_NAYARA',
    totalVencimentos: 2524.37,
    totalDescontos:   1125.42,
    valorLiquido:     1398.95,
    fgtsMes:          201.94,
    salContrInss:     2524.37,
    obs:             'Babá da Nayara → Adiantamento Nayara (1.1.3.04.04)',
    debitCode:       '1.1.3.04.04',
  },
  {
    nome:            'JOSIMAR DOS SANTOS MOTA',
    cargo:           'COORDENADOR CONTABIL',
    cc_dominio:      'CUSTOS OPERACIONAIS',
    cc_contabil:     'CUSTOS_OPERACIONAIS',
    totalVencimentos: 3762.00,
    totalDescontos:   1948.78,
    valorLiquido:     1813.22,
    fgtsMes:          300.96,
    salContrInss:     3762.00,
    obs:             '',
    debitCode:       '4.1.1.01',
  },
  {
    nome:            'RAIMUNDO PEREIRA MOREIRA',
    cargo:           'CASEIRO',
    cc_dominio:      'DESPESAS ADMINISTRATIVAS',
    cc_contabil:     'ADIANTAMENTO_SERGIO',
    totalVencimentos: 2687.50,
    totalDescontos:   219.10,
    valorLiquido:     2468.40,
    fgtsMes:          215.00,
    salContrInss:     2687.50,
    obs:             'Caseiro propriedade pessoal Sérgio → Adiantamento Sérgio Carneiro (1.1.3.04.01)',
    debitCode:       '1.1.3.04.01',
  },
  {
    nome:            'SERGIO AUGUSTO DE OLIVEIRA LEAO',
    cargo:           'AUXILIAR ADMINISTRATIVO',
    cc_dominio:      'DESPESAS ADMINISTRATIVAS',
    cc_contabil:     'ADIANTAMENTO_AUGUSTO',
    totalVencimentos: 2950.00,
    totalDescontos:   1358.00,
    valorLiquido:     1592.00,
    fgtsMes:          236.00,
    salContrInss:     0.00,       // INSS = 0 no holerite
    obs:             'Filho (mesada) — não trabalha na Ampla → Adiantamento Sérgio Augusto (1.1.3.04.05)',
    debitCode:       '1.1.3.04.05',
  },
  {
    nome:            'THAYNARA CONCEICAO DE MELO',
    cargo:           'ANALISTA CONTABIL',
    cc_dominio:      'CUSTOS OPERACIONAIS',
    cc_contabil:     'CUSTOS_OPERACIONAIS',
    totalVencimentos: 4027.75,
    totalDescontos:   2006.83,
    valorLiquido:     2020.92,
    fgtsMes:          322.22,
    salContrInss:     4027.75,
    obs:             '',
    debitCode:       '4.1.1.01',
  },
];

// ── Utilitários ───────────────────────────────────────────────────────────────
function slug(nome) {
  return nome.trim().replace(/\s+/g, '_').toLowerCase()
             .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
             .slice(0, 30);
}

function fmt(v) {
  return `R$ ${Number(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

// ── Helpers de manutenção ─────────────────────────────────────────────────────
async function ativarManutencao() {
  await supabase.from('system_maintenance').upsert(
    { key: 'accounting_maintenance', value: { enabled: true }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  console.log('🔧  Modo manutenção ATIVADO');
}

async function desativarManutencao() {
  await supabase.from('system_maintenance').upsert(
    { key: 'accounting_maintenance', value: { enabled: false }, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  console.log('🔓  Modo manutenção DESATIVADO');
}

async function reabrirPeriodo() {
  await supabase.from('monthly_closings')
    .update({ status: 'open' })
    .eq('tenant_id', TENANT_ID)
    .eq('reference_month', '2025-01-01');
  console.log('📅  monthly_closings Jan/2025 aberto');
}

async function fecharPeriodo() {
  await supabase.from('monthly_closings')
    .update({ status: 'closed' })
    .eq('tenant_id', TENANT_ID)
    .eq('reference_month', '2025-01-01');
  console.log('🔒  monthly_closings Jan/2025 fechado');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🧾  Importação Folha de Pagamento — ${COMPETENCIA}`);
  console.log(`    Tenant: ${TENANT_ID}`);
  console.log(`    Funcionários no PDF: ${HOLERITES.length}\n`);

  // 0. Ativar modo manutenção (período fechado)
  await ativarManutencao();
  await reabrirPeriodo();

  // 1. Buscar IDs das contas contábeis necessárias
  const codesNeeded = [...new Set([
    '4.1.1.01', '4.1.1.04', '1.1.1.05', '2.1.2.02',
    '1.1.3.04.01', '1.1.3.04.04', '1.1.3.04.05',
  ])];

  const { data: chartAccounts, error: caErr } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .in('code', codesNeeded)
    .eq('tenant_id', TENANT_ID);

  if (caErr) { console.error('❌ Erro ao buscar plano de contas:', caErr.message); process.exit(1); }

  const acMap = {};
  (chartAccounts || []).forEach(a => { acMap[a.code] = { id: a.id, name: a.name }; });

  console.log('📋  Contas encontradas:');
  codesNeeded.forEach(c => {
    const found = acMap[c];
    console.log(`    ${found ? '✅' : '❌'} ${c} — ${found?.name || 'NÃO ENCONTRADA'}`);
  });

  const missingCodes = codesNeeded.filter(c => !acMap[c]);
  if (missingCodes.length > 0) {
    console.error(`\n❌ Contas faltando no plano de contas: ${missingCodes.join(', ')}`);
    console.error('   Execute a migration de plano de contas primeiro.');
    process.exit(1);
  }

  // 2. Verificar se já existem lançamentos desta folha (evitar duplicatas)
  const { data: existing } = await supabase
    .from('accounting_entries')
    .select('id, internal_code')
    .eq('tenant_id', TENANT_ID)
    .eq('source_type', 'payroll')
    .like('internal_code', `%_${MES_ANO}`)
    .like('internal_code', 'holerite_%');

  const existingCodes = new Set((existing || []).map(e => e.internal_code));
  console.log(`\n🔍  Lançamentos já existentes para ${COMPETENCIA}: ${existingCodes.size}`);
  if (existingCodes.size > 0) {
    console.log('    Códigos existentes:', [...existingCodes].join(', '));
  }

  // 3. Importar cada holerite
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  let importados = 0, pulados = 0, erros = 0;
  const totalFgts = { value: 0 };

  for (const h of HOLERITES) {
    const code = `holerite_${slug(h.nome)}_${MES_ANO}`;
    const prefix = `  [${h.nome}]`;

    // Pular rescisões com líquido zero
    if (h.valorLiquido === 0) {
      console.log(`${prefix}`);
      console.log(`    ⏭️  RESCISÃO com líquido R$0,00 — pulado (sem saída bancária)`);
      pulados++;
      totalFgts.value += h.fgtsMes; // FGTS ainda pode ser relevante para provisão
      continue;
    }

    // Pular duplicatas
    if (existingCodes.has(code)) {
      console.log(`${prefix}`);
      console.log(`    ⚠️  Já importado (${code}) — pulado`);
      pulados++;
      continue;
    }

    console.log(`${prefix} — ${h.cargo} | CC: ${h.cc_dominio}`);
    console.log(`    Bruto: ${fmt(h.totalVencimentos)} | Desc: ${fmt(h.totalDescontos)} | Líquido: ${fmt(h.valorLiquido)}`);
    console.log(`    Débito: ${h.debitCode} ${acMap[h.debitCode]?.name}`);
    console.log(`    Crédito: 1.1.1.05 ${acMap['1.1.1.05']?.name}`);
    if (h.obs) console.log(`    ℹ️  ${h.obs}`);

    // Criar entry principal
    const { data: entry, error: entryErr } = await supabase
      .from('accounting_entries')
      .insert({
        tenant_id:       TENANT_ID,
        entry_date:      ENTRY_DATE,
        competence_date: ENTRY_DATE,
        description:     `Holerite ${COMPETENCIA} — ${h.nome} (${h.cargo})`,
        source_type:     'payroll',
        entry_type:      'manual',
        internal_code:   code,
      })
      .select('id')
      .single();

    if (entryErr) {
      console.error(`    ❌ Erro ao criar entry: ${entryErr.message}`);
      erros++;
      continue;
    }

    // Criar itens (débito e crédito)
    const { error: itemsErr } = await supabase
      .from('accounting_entry_items')
      .insert([
        {
          entry_id:    entry.id,
          account_id:  acMap[h.debitCode].id,
          debit:       h.valorLiquido,
          credit:      0,
          description: `Salário líquido — ${h.nome}`,
          tenant_id:   TENANT_ID,
        },
        {
          entry_id:    entry.id,
          account_id:  acMap['1.1.1.05'].id,
          debit:       0,
          credit:      h.valorLiquido,
          description: `Pgto folha via Banco Sicredi — ${h.nome}`,
          tenant_id:   TENANT_ID,
        },
      ]);

    if (itemsErr) {
      console.error(`    ❌ Erro ao criar items: ${itemsErr.message}`);
      erros++;
    } else {
      console.log(`    ✅ Importado — entry: ${entry.id}`);
      importados++;
    }

    totalFgts.value += h.fgtsMes;
  }

  // 4. Lançamento consolidado de FGTS (se não existir)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const fgtsCode = `holerite_fgts_${MES_ANO}`;
  if (totalFgts.value > 0 && !existingCodes.has(fgtsCode)) {
    console.log(`\n💼  FGTS Patronal consolidado: ${fmt(totalFgts.value)}`);
    console.log(`    Débito:  4.1.1.04 ${acMap['4.1.1.04']?.name}`);
    console.log(`    Crédito: 2.1.2.02 ${acMap['2.1.2.02']?.name}`);

    const { data: fgtsEntry, error: fgtsErr } = await supabase
      .from('accounting_entries')
      .insert({
        tenant_id:       TENANT_ID,
        entry_date:      ENTRY_DATE,
        competence_date: ENTRY_DATE,
        description:     `FGTS Patronal — Folha ${COMPETENCIA}`,
        source_type:     'payroll',
        entry_type:      'manual',
        internal_code:   fgtsCode,
      })
      .select('id')
      .single();

    if (!fgtsErr && fgtsEntry?.id) {
      const { error: fgtsItemErr } = await supabase
        .from('accounting_entry_items')
        .insert([
          { entry_id: fgtsEntry.id, account_id: acMap['4.1.1.04'].id, debit: totalFgts.value, credit: 0, description: 'FGTS patronal — Folha Jan/2025', tenant_id: TENANT_ID },
          { entry_id: fgtsEntry.id, account_id: acMap['2.1.2.02'].id, debit: 0, credit: totalFgts.value, description: 'FGTS a Recolher — Folha Jan/2025', tenant_id: TENANT_ID },
        ]);

      if (!fgtsItemErr) {
        console.log(`    ✅ FGTS importado — entry: ${fgtsEntry.id}`);
        importados++;
      } else {
        console.error(`    ❌ Erro FGTS items: ${fgtsItemErr.message}`);
        erros++;
      }
    } else if (fgtsErr) {
      console.error(`    ❌ Erro FGTS entry: ${fgtsErr.message}`);
      erros++;
    }
  } else if (existingCodes.has(fgtsCode)) {
    console.log(`\n⚠️  FGTS já importado — pulado`);
    pulados++;
  }

  // 5. Resumo
  const totalLiquido = HOLERITES.filter(h => h.valorLiquido > 0).reduce((s, h) => s + h.valorLiquido, 0);
  // 6. Fechar período e desativar manutenção
  await fecharPeriodo();
  await desativarManutencao();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`\n📊  RESUMO DA IMPORTAÇÃO:`);
  console.log(`    ✅ Importados: ${importados}`);
  console.log(`    ⚠️  Pulados:   ${pulados}`);
  console.log(`    ❌ Erros:     ${erros}`);
  console.log(`\n    💰 Total líquido saído do banco: ${fmt(totalLiquido)}`);
  console.log(`    💼 Total FGTS a recolher:         ${fmt(totalFgts.value)}`);
  console.log('\n');
}

main().catch(err => { console.error('❌ Erro fatal:', err); process.exit(1); });
