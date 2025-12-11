// Script para análise profunda do DRE
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function analyze() {
  // Buscar TODAS as contas de despesa (4.x)
  const { data: contas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .like('code', '4%')
    .order('code');

  console.log('========================================');
  console.log('   ANÁLISE DETALHADA - DRE DESPESAS');
  console.log('   Chamando Dr. Cícero para análise');
  console.log('========================================\n');

  const problemasIdentificados = [];

  for (const conta of contas || []) {
    // Buscar linhas desta conta
    const { data: lines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit, entry_id(id, description)')
      .eq('account_id', conta.id);

    if (!lines || lines.length === 0) continue;

    let totalDebit = 0;
    for (const l of lines) {
      totalDebit += l.debit || 0;
    }

    if (totalDebit === 0) continue;

    console.log('\n=== ' + conta.code + ' - ' + conta.name + ' ===');
    console.log('Total: R$ ' + totalDebit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

    // Agrupar por descrição
    const porDescricao = {};
    for (const l of lines) {
      const desc = l.entry_id?.description || 'SEM DESCRIÇÃO';
      if (!porDescricao[desc]) porDescricao[desc] = { total: 0, entryId: l.entry_id?.id };
      porDescricao[desc].total += l.debit || 0;
    }

    const sorted = Object.entries(porDescricao)
      .sort((a, b) => b[1].total - a[1].total)
      .filter(([_, v]) => v.total > 0);

    for (const [desc, info] of sorted.slice(0, 10)) {
      console.log('  - ' + desc.substring(0, 60) + ': R$ ' + info.total.toLocaleString('pt-BR'));

      // Dr. Cícero analisa: é gasto pessoal da família?
      const descLower = desc.toLowerCase();
      const isPessoal =
        descLower.includes('sergio') ||
        descLower.includes('sérgio') ||
        descLower.includes('victor') ||
        descLower.includes('nayara') ||
        descLower.includes('carla') ||
        descLower.includes('familia') ||
        descLower.includes('família') ||
        descLower.includes('pessoal') ||
        descLower.includes('casa') ||
        descLower.includes('sitio') ||
        descLower.includes('sítio') ||
        descLower.includes('condomínio') ||
        descLower.includes('condominio') ||
        descLower.includes('ipva') ||
        descLower.includes('saúde') ||
        descLower.includes('saude') ||
        descLower.includes('baba') ||
        descLower.includes('babá');

      if (isPessoal) {
        console.log('    ⚠️  Dr. Cícero: Possível gasto pessoal da família!');
        problemasIdentificados.push({
          conta: conta.code,
          contaNome: conta.name,
          descricao: desc,
          valor: info.total,
          entryId: info.entryId
        });
      }
    }
  }

  console.log('\n========================================');
  console.log('   DIAGNÓSTICO DO Dr. CÍCERO');
  console.log('========================================\n');

  if (problemasIdentificados.length === 0) {
    console.log('✅ Nenhum gasto pessoal encontrado nas despesas operacionais.');
    console.log('   O DRE parece estar correto.');
  } else {
    console.log('⚠️  ATENÇÃO: ' + problemasIdentificados.length + ' possíveis gastos pessoais em despesas operacionais:\n');

    let totalProblemas = 0;
    for (const p of problemasIdentificados) {
      console.log('❌ ' + p.descricao);
      console.log('   Conta atual: ' + p.conta + ' - ' + p.contaNome);
      console.log('   Valor: R$ ' + p.valor.toLocaleString('pt-BR'));
      console.log('   Correção: Mover para conta de Adiantamento a Sócios (1.1.3.04.xx)');
      console.log('');
      totalProblemas += p.valor;
    }

    console.log('----------------------------------------');
    console.log('TOTAL A RECLASSIFICAR: R$ ' + totalProblemas.toLocaleString('pt-BR'));
  }

  // Verificar despesa de Obras e Reformas
  console.log('\n========================================');
  console.log('   VERIFICAÇÃO ESPECIAL: OBRAS');
  console.log('========================================\n');

  const { data: obras } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '4.1.2.11')
    .single();

  if (obras) {
    const { data: obrasLines } = await supabase
      .from('accounting_entry_lines')
      .select('debit, entry_id(description)')
      .eq('account_id', obras.id);

    console.log('Obras e Reformas Sede (4.1.2.11):');
    for (const l of obrasLines || []) {
      console.log('  - ' + (l.entry_id?.description || 'SEM DESC') + ': R$ ' + (l.debit || 0).toLocaleString('pt-BR'));
    }
  }
}

analyze().catch(console.error);
