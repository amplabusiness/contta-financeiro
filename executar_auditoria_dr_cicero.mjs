#!/usr/bin/env node
/**
 * executar_auditoria_dr_cicero.mjs
 * 
 * Script para executar auditoria mensal do Dr. Cícero via linha de comando
 * 
 * Uso:
 *   node executar_auditoria_dr_cicero.mjs --competencia=2025-01
 *   node executar_auditoria_dr_cicero.mjs --competencia=2025-01 --verbose
 *   node executar_auditoria_dr_cicero.mjs --competencia=2025-01 --output=relatorio.md
 * 
 * @author Sérgio Carneiro Leão (CRC/GO 008074)
 * @date 30/01/2026
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { writeFileSync } from 'fs';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Carregar variáveis de ambiente
config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Tenant padrão (Ampla Contabilidade)
const TENANT_ID = 'a53a4957-fe97-4856-b3ca-70045157b421';

// Contas importantes
const CONTAS = {
  BANCO_SICREDI: '10d5892d-a843-4034-8d62-9fec95b8fd56',
  TRANSITORIA_DEBITOS: '3e1fd22f-fba2-4cc2-b628-9d729233bca0',
  TRANSITORIA_CREDITOS: '28085461-9e5a-4fb4-847d-c9fc047fe0a1'
};

// ============================================================================
// PARSE ARGUMENTS
// ============================================================================

function parseArgs() {
  const args = {};
  process.argv.slice(2).forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.substring(2).split('=');
      args[key] = value || true;
    }
  });
  return args;
}

// ============================================================================
// AUDIT SERVICE
// ============================================================================

class DrCiceroAuditCLI {
  constructor(competencia, verbose = false) {
    this.competencia = parseISO(`${competencia}-01`);
    this.inicio = startOfMonth(this.competencia);
    this.fim = endOfMonth(this.competencia);
    this.verbose = verbose;
    this.results = [];
    this.inconsistencias = [];
  }

  log(message, ...args) {
    if (this.verbose) {
      console.log(message, ...args);
    }
  }

  async executar() {
    console.log('');
    console.log('═'.repeat(80));
    console.log('        🔍 DR. CÍCERO — AUDITORIA CONTÁBIL MENSAL');
    console.log('═'.repeat(80));
    console.log('');
    console.log(`  Competência: ${format(this.competencia, 'MMMM/yyyy', { locale: ptBR })}`);
    console.log(`  Período: ${format(this.inicio, 'dd/MM/yyyy')} a ${format(this.fim, 'dd/MM/yyyy')}`);
    console.log(`  Tenant: ${TENANT_ID}`);
    console.log('');
    console.log('─'.repeat(80));

    const startTime = Date.now();

    // Executar testes
    await this.testeConciliacaoBancoContabil();
    await this.testeValidacaoReceita();
    await this.testeContasTransitorias();
    await this.testeIntegridadeContabil();

    const executionTime = Date.now() - startTime;

    // Determinar status final
    const status = this.determinarStatus();
    const protocolo = this.gerarProtocolo();

    // Exibir resultados
    this.exibirResultados(status, protocolo, executionTime);

    // Persistir resultado
    await this.persistirResultado(status, protocolo);

    return { status, protocolo, inconsistencias: this.inconsistencias };
  }

  // --------------------------------------------------------------------------
  // TESTE A: CONCILIAÇÃO BANCO × CONTÁBIL
  // --------------------------------------------------------------------------

  async testeConciliacaoBancoContabil() {
    console.log('');
    console.log('  📊 TESTE A: Conciliação Banco × Contábil');
    console.log('  ' + '─'.repeat(60));

    const { data: transacoes } = await supabase
      .from('bank_transactions')
      .select('id, fitid, amount, journal_entry_id')
      .eq('tenant_id', TENANT_ID)
      .gte('transaction_date', this.inicio.toISOString().split('T')[0])
      .lte('transaction_date', this.fim.toISOString().split('T')[0]);

    const total = transacoes?.length || 0;
    const comLancamento = transacoes?.filter(t => t.journal_entry_id).length || 0;
    const semLancamento = total - comLancamento;
    const taxa = total > 0 ? ((comLancamento / total) * 100).toFixed(2) : '100.00';

    console.log(`  Transações no período: ${total}`);
    console.log(`  Com lançamento:        ${comLancamento}`);
    console.log(`  Sem lançamento:        ${semLancamento}`);
    console.log(`  Taxa de conciliação:   ${taxa}%`);

    const status = semLancamento === 0 ? 'OK' : 'ERRO';
    console.log(`  Status:                ${status === 'OK' ? '✅ OK' : '❌ ERRO'}`);

    if (semLancamento > 0) {
      this.inconsistencias.push({
        tipo: 'BANCO_SEM_LANCAMENTO',
        descricao: `${semLancamento} transações bancárias sem lançamento contábil`,
        valor: 0,
        fundamentacao: 'NBC ITG 2000 - Toda movimentação financeira deve ter registro contábil'
      });
    }

    this.results.push({
      nome: 'Conciliação Banco × Contábil',
      status,
      detalhes: { total, comLancamento, semLancamento, taxa }
    });
  }

  // --------------------------------------------------------------------------
  // TESTE B: VALIDAÇÃO DE RECEITA
  // --------------------------------------------------------------------------

  async testeValidacaoReceita() {
    console.log('');
    console.log('  💰 TESTE B: Validação de Receita');
    console.log('  ' + '─'.repeat(60));

    // Buscar honorários cadastrados
    const { data: honorarios } = await supabase
      .from('honorarios')
      .select('base_value')
      .eq('tenant_id', TENANT_ID)
      .lte('competencia_inicio', this.fim.toISOString().split('T')[0])
      .or(`competencia_fim.is.null,competencia_fim.gte.${this.inicio.toISOString().split('T')[0]}`);

    const totalHonorarios = honorarios?.reduce((sum, h) => sum + (h.base_value || 0), 0) || 0;

    // Buscar receita contabilizada diretamente
    let receitaLiquida = 0;
    {
      const { data: entries } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .gte('entry_date', this.inicio.toISOString().split('T')[0])
        .lte('entry_date', this.fim.toISOString().split('T')[0]);

      if (entries?.length) {
        const entryIds = entries.map(e => e.id);
        
        // Buscar conta de honorários
        const { data: contaHonorarios } = await supabase
          .from('chart_of_accounts')
          .select('id')
          .eq('tenant_id', TENANT_ID)
          .eq('code', '3.1.1.01')
          .single();

        if (contaHonorarios) {
          const { data: linhas } = await supabase
            .from('accounting_entry_lines')
            .select('debit, credit')
            .eq('account_id', contaHonorarios.id)
            .in('entry_id', entryIds);

          const totalC = linhas?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;
          const totalD = linhas?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
          receitaLiquida = totalC - totalD;
        }
      }
    }

    const diferenca = receitaLiquida - totalHonorarios;

    console.log(`  Honorários cadastrados: R$ ${totalHonorarios.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Receita DRE:            R$ ${receitaLiquida.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Diferença:              R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

    const status = Math.abs(diferenca) <= 0.01 || totalHonorarios === 0 ? 'OK' : 
                   (diferenca > totalHonorarios * 0.1 ? 'ERRO' : 'ALERTA');
    
    console.log(`  Status:                 ${status === 'OK' ? '✅ OK' : status === 'ALERTA' ? '⚠️ ALERTA' : '❌ ERRO'}`);

    if (diferenca > 0.01 && totalHonorarios > 0) {
      this.inconsistencias.push({
        tipo: 'RECEITA_INFLADA',
        descricao: `Receita excede honorários em R$ ${diferenca.toFixed(2)}`,
        valor: diferenca,
        fundamentacao: 'Receita só deve ser reconhecida mediante honorário cadastrado'
      });
    }

    this.results.push({
      nome: 'Validação de Receita',
      status,
      detalhes: { totalHonorarios, receitaLiquida, diferenca }
    });
  }

  // --------------------------------------------------------------------------
  // TESTE C: CONTAS TRANSITÓRIAS
  // --------------------------------------------------------------------------

  async testeContasTransitorias() {
    console.log('');
    console.log('  🔄 TESTE C: Contas Transitórias');
    console.log('  ' + '─'.repeat(60));

    const contas = [
      { id: CONTAS.TRANSITORIA_DEBITOS, nome: 'Transitória Débitos', codigo: '1.1.9.01' },
      { id: CONTAS.TRANSITORIA_CREDITOS, nome: 'Transitória Créditos', codigo: '2.1.9.01' }
    ];

    let todasZeradas = true;

    for (const conta of contas) {
      const { data: entries } = await supabase
        .from('accounting_entries')
        .select('id')
        .eq('tenant_id', TENANT_ID)
        .gte('entry_date', this.inicio.toISOString().split('T')[0])
        .lte('entry_date', this.fim.toISOString().split('T')[0]);

      let saldo = 0;
      if (entries?.length) {
        const entryIds = entries.map(e => e.id);
        const { data: linhas } = await supabase
          .from('accounting_entry_lines')
          .select('debit, credit')
          .eq('account_id', conta.id)
          .in('entry_id', entryIds);

        const totalD = linhas?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
        const totalC = linhas?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;
        saldo = totalD - totalC;
      }

      const zerada = Math.abs(saldo) <= 0.01;
      const statusIcon = zerada ? '✅' : '❌';
      
      console.log(`  ${conta.codigo} (${conta.nome}):`);
      console.log(`    Saldo: R$ ${saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ${statusIcon}`);

      if (!zerada) {
        todasZeradas = false;
        this.inconsistencias.push({
          tipo: 'TRANSITORIA_NAO_ZERADA',
          descricao: `${conta.codigo} com saldo R$ ${saldo.toFixed(2)}`,
          valor: Math.abs(saldo),
          fundamentacao: 'Contas transitórias devem zerar - indica classificações pendentes'
        });
      }
    }

    const status = todasZeradas ? 'OK' : 'ERRO';
    console.log(`  Status geral:          ${status === 'OK' ? '✅ OK' : '❌ ERRO'}`);

    this.results.push({
      nome: 'Contas Transitórias',
      status,
      detalhes: { todasZeradas }
    });
  }

  // --------------------------------------------------------------------------
  // TESTE D: INTEGRIDADE CONTÁBIL
  // --------------------------------------------------------------------------

  async testeIntegridadeContabil() {
    console.log('');
    console.log('  ⚖️ TESTE D: Integridade Contábil (Partidas Dobradas)');
    console.log('  ' + '─'.repeat(60));

    const { data: entries } = await supabase
      .from('accounting_entries')
      .select('id, internal_code')
      .eq('tenant_id', TENANT_ID)
      .gte('entry_date', this.inicio.toISOString().split('T')[0])
      .lte('entry_date', this.fim.toISOString().split('T')[0]);

    let totalDebitos = 0;
    let totalCreditos = 0;
    let desbalanceados = 0;

    for (const entry of entries || []) {
      const { data: linhas } = await supabase
        .from('accounting_entry_lines')
        .select('debit, credit')
        .eq('entry_id', entry.id);

      const d = linhas?.reduce((s, l) => s + Number(l.debit || 0), 0) || 0;
      const c = linhas?.reduce((s, l) => s + Number(l.credit || 0), 0) || 0;

      totalDebitos += d;
      totalCreditos += c;

      if (Math.abs(d - c) > 0.01) {
        desbalanceados++;
      }
    }

    const diferenca = Math.abs(totalDebitos - totalCreditos);

    console.log(`  Total Débitos:         R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Total Créditos:        R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Diferença Global:      R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`  Lançamentos:           ${entries?.length || 0}`);
    console.log(`  Desbalanceados:        ${desbalanceados}`);

    const status = diferenca <= 0.01 && desbalanceados === 0 ? 'OK' : 'ERRO';
    console.log(`  Status:                ${status === 'OK' ? '✅ OK' : '❌ ERRO'}`);

    if (diferenca > 0.01) {
      this.inconsistencias.push({
        tipo: 'PARTIDAS_DESBALANCEADAS',
        descricao: `Diferença global de R$ ${diferenca.toFixed(2)}`,
        valor: diferenca,
        fundamentacao: 'NBC ITG 2000 - Partidas dobradas: Σ Débitos = Σ Créditos'
      });
    }

    if (desbalanceados > 0) {
      this.inconsistencias.push({
        tipo: 'LANCAMENTOS_DESBALANCEADOS',
        descricao: `${desbalanceados} lançamentos com D ≠ C`,
        valor: 0,
        fundamentacao: 'Cada lançamento deve ter débitos = créditos'
      });
    }

    this.results.push({
      nome: 'Integridade Contábil',
      status,
      detalhes: { totalDebitos, totalCreditos, diferenca, desbalanceados }
    });
  }

  // --------------------------------------------------------------------------
  // HELPERS
  // --------------------------------------------------------------------------

  determinarStatus() {
    return this.results.some(r => r.status === 'ERRO') ? 'INVALIDATED' : 'APPROVED';
  }

  gerarProtocolo() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const mes = format(this.competencia, 'yyyyMM');
    return `AUD-${mes}-${timestamp}`;
  }

  exibirResultados(status, protocolo, executionTime) {
    console.log('');
    console.log('═'.repeat(80));
    console.log('        📋 RESULTADO DA AUDITORIA');
    console.log('═'.repeat(80));
    console.log('');
    console.log(`  Protocolo:   ${protocolo}`);
    console.log(`  Tempo:       ${executionTime}ms`);
    console.log('');

    // Resumo dos testes
    console.log('  TESTES REALIZADOS:');
    this.results.forEach(r => {
      const icon = r.status === 'OK' ? '✅' : r.status === 'ALERTA' ? '⚠️' : '❌';
      console.log(`    ${icon} ${r.nome}`);
    });

    // Inconsistências
    if (this.inconsistencias.length > 0) {
      console.log('');
      console.log('  ⚠️ INCONSISTÊNCIAS ENCONTRADAS:');
      this.inconsistencias.forEach((inc, i) => {
        console.log(`    ${i + 1}. [${inc.tipo}] ${inc.descricao}`);
      });
    }

    // Status final
    console.log('');
    console.log('─'.repeat(80));
    console.log('');
    if (status === 'APPROVED') {
      console.log('  ╔═══════════════════════════════════════════════════════════════════╗');
      console.log('  ║                                                                   ║');
      console.log('  ║                    ✅ FECHAMENTO APROVADO                         ║');
      console.log('  ║                                                                   ║');
      console.log('  ╚═══════════════════════════════════════════════════════════════════╝');
    } else {
      console.log('  ╔═══════════════════════════════════════════════════════════════════╗');
      console.log('  ║                                                                   ║');
      console.log('  ║                    ❌ FECHAMENTO INVALIDADO                       ║');
      console.log('  ║                                                                   ║');
      console.log('  ╚═══════════════════════════════════════════════════════════════════╝');
    }
    console.log('');
    console.log('═'.repeat(80));
    console.log('');
  }

  async persistirResultado(status, protocolo) {
    const resultado = {
      testes: this.results,
      inconsistencias: this.inconsistencias
    };

    const { error } = await supabase
      .from('audit_results')
      .upsert({
        tenant_id: TENANT_ID,
        protocolo,
        competencia: this.inicio.toISOString().split('T')[0],
        status,
        resultado,
        parecer: status === 'APPROVED' 
          ? 'Fechamento aprovado. Todos os testes passaram.'
          : `Fechamento invalidado. ${this.inconsistencias.length} inconsistência(s) encontrada(s).`,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.log('  ⚠️ Não foi possível persistir resultado:', error.message);
    } else {
      console.log('  ✅ Resultado persistido no banco de dados');
    }
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const args = parseArgs();

  if (!args.competencia) {
    console.error('❌ Uso: node executar_auditoria_dr_cicero.mjs --competencia=YYYY-MM');
    console.error('   Exemplo: node executar_auditoria_dr_cicero.mjs --competencia=2025-01');
    process.exit(1);
  }

  const audit = new DrCiceroAuditCLI(args.competencia, args.verbose);
  const result = await audit.executar();

  // Salvar relatório em arquivo se solicitado
  if (args.output) {
    const relatorio = gerarRelatorioMarkdown(result, args.competencia);
    writeFileSync(args.output, relatorio);
    console.log(`  📄 Relatório salvo em: ${args.output}`);
  }

  // Exit code baseado no status
  process.exit(result.status === 'APPROVED' ? 0 : 1);
}

function gerarRelatorioMarkdown(result, competencia) {
  return `# Relatório de Auditoria - ${competencia}

## Status: ${result.status}

## Protocolo: ${result.protocolo}

## Inconsistências

${result.inconsistencias.map(i => `- **${i.tipo}**: ${i.descricao}`).join('\n')}

---

*Gerado automaticamente pelo Dr. Cícero em ${new Date().toISOString()}*
`;
}

main().catch(err => {
  console.error('❌ Erro na execução:', err);
  process.exit(1);
});
