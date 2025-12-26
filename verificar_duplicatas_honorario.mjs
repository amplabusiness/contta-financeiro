#!/usr/bin/env node

/**
 * ============================================================
 * VERIFICAÇÃO DE DUPLICATAS - BANCO CORRETO (honorario)
 * ============================================================
 * Script para verificar duplicatas no banco de PRODUÇÃO
 * Conecta ao projeto honorario (o que tem os dados reais)
 * 
 * Data: 26 de Dezembro de 2025
 * Status: Pronto para usar com credenciais do honorario
 * ============================================================
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================
// CONFIGURAÇÃO DO SUPABASE - BANCO CORRETO (honorario)
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL_HONORARIO || 'https://honorario.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY_HONORARIO || '';

if (!SUPABASE_KEY) {
  console.error('❌ ERRO: Credenciais do Supabase não configuradas!');
  console.error('Defina: SUPABASE_URL_HONORARIO e SUPABASE_ANON_KEY_HONORARIO');
  console.error('');
  console.error('As credenciais devem ser do projeto "honorario" (produção)');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// CORES PARA OUTPUT
// ============================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(color, message) {
  console.log(`${color}${message}${colors.reset}`);
}

function logHeader(message) {
  console.log('');
  log(colors.bold + colors.cyan, `▶ ${message}`);
  console.log('');
}

function logSuccess(message) {
  log(colors.green, `✅ ${message}`);
}

function logError(message) {
  log(colors.red, `❌ ${message}`);
}

function logWarning(message) {
  log(colors.yellow, `⚠️  ${message}`);
}

function logInfo(message) {
  log(colors.blue, `ℹ️  ${message}`);
}

// ============================================================
// VERIFICAÇÕES
// ============================================================

async function verificarDuplicatasHoje() {
  logHeader('1. VERIFICANDO DUPLICATAS - HOJE (26/12/2025)');

  try {
    // Buscar despesas de hoje duplicadas
    const { data: despesasDuplicadas, error: erroDespesas } = await supabase.rpc(
      'get_duplicated_expenses_for_date',
      { target_date: '2025-12-26' }
    );

    if (erroDespesas) {
      logWarning(`Procedure não existe ou erro: ${erroDespesas.message}`);
      
      // Fallback: Consulta manual
      const { data: despesas, error } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', '2025-12-26T00:00:00')
        .lt('created_at', '2025-12-27T00:00:00');

      if (error) {
        logError(`Erro ao buscar despesas: ${error.message}`);
        return;
      }

      const despesasTotal = despesas?.length || 0;
      logInfo(`Despesas de hoje (26/12): ${despesasTotal} registros`);

      if (despesasTotal > 0) {
        // Agrupamento simples para detectar padrões
        const agrupado = {};
        despesas.forEach(d => {
          const chave = `${d.description}|${d.value}|${d.category}`;
          agrupado[chave] = (agrupado[chave] || 0) + 1;
        });

        const suspeitas = Object.entries(agrupado).filter(([_, count]) => count > 1);
        
        if (suspeitas.length > 0) {
          logWarning(`Encontradas ${suspeitas.length} possíveis duplicatas:`);
          suspeitas.forEach(([chave, count]) => {
            const [desc, value, category] = chave.split('|');
            console.log(`  - ${desc} (R$ ${value}) em ${category}: ${count}x`);
          });
        } else {
          logSuccess('Nenhuma duplicata encontrada em despesas de hoje');
        }
      }
    } else {
      if (despesasDuplicadas && despesasDuplicadas.length > 0) {
        logError(`⚠️ ${despesasDuplicadas.length} despesas duplicadas encontradas!`);
        despesasDuplicadas.forEach(d => {
          console.log(`  - ${d.description}: ${d.count}x`);
        });
      } else {
        logSuccess('Nenhuma duplicata em despesas');
      }
    }

  } catch (err) {
    logError(`Erro geral: ${err.message}`);
  }
}

async function verificarDuplicatas30Dias() {
  logHeader('2. VERIFICANDO DUPLICATAS - ÚLTIMOS 30 DIAS');

  try {
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - 30);
    dataInicio.setHours(0, 0, 0, 0);

    const { data: despesas, error } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', dataInicio.toISOString());

    if (error) {
      logError(`Erro ao buscar despesas: ${error.message}`);
      return;
    }

    const totalDespesas = despesas?.length || 0;
    logInfo(`Total de despesas nos últimos 30 dias: ${totalDespesas}`);

    if (totalDespesas === 0) {
      logWarning('Nenhuma despesa encontrada no período');
      return;
    }

    // Agrupar por usuário + descrição + valor + data
    const agrupado = {};
    despesas.forEach(d => {
      const chave = `${d.user_id || 'sem-user'}|${d.description}|${d.value}|${d.created_at.split('T')[0]}`;
      if (!agrupado[chave]) {
        agrupado[chave] = [];
      }
      agrupado[chave].push(d);
    });

    const duplicatas = Object.values(agrupado).filter(grupo => grupo.length > 1);

    if (duplicatas.length > 0) {
      logError(`Encontradas ${duplicatas.length} grupos com duplicatas!`);
      duplicatas.forEach(grupo => {
        const primeiro = grupo[0];
        console.log(`\n  Descrição: ${primeiro.description}`);
        console.log(`  Valor: R$ ${primeiro.value}`);
        console.log(`  Usuário: ${primeiro.user_id}`);
        console.log(`  Quantidade: ${grupo.length}x`);
        grupo.forEach((d, i) => {
          console.log(`    ${i + 1}. ${d.created_at} (ID: ${d.id})`);
        });
      });
    } else {
      logSuccess(`Nenhuma duplicata encontrada (${totalDespesas} registros verificados)`);
    }

  } catch (err) {
    logError(`Erro geral: ${err.message}`);
  }
}

async function verificarTotalRegistros() {
  logHeader('3. VERIFICANDO TOTAL DE REGISTROS');

  try {
    // Tabelas principais
    const tabelas = [
      'expenses',
      'accounting_entries',
      'invoices',
      'clients',
      'employees',
      'rastreamento',
    ];

    for (const tabela of tabelas) {
      try {
        const { count, error } = await supabase
          .from(tabela)
          .select('*', { count: 'exact', head: true });

        if (error) {
          logWarning(`Erro ao contar ${tabela}: ${error.message}`);
        } else {
          logInfo(`${tabela}: ${count} registros`);
        }
      } catch (err) {
        logWarning(`Erro ao acessar ${tabela}: ${err.message}`);
      }
    }

  } catch (err) {
    logError(`Erro geral: ${err.message}`);
  }
}

async function verificarDadosJaneiro() {
  logHeader('4. VERIFICANDO DADOS DE JANEIRO/2025');

  try {
    const { data: despesas, error: erroDespesas } = await supabase
      .from('expenses')
      .select('*')
      .gte('created_at', '2025-01-01T00:00:00')
      .lt('created_at', '2025-02-01T00:00:00');

    const { data: adiantamentos, error: erroAdiantamentos } = await supabase
      .from('accounting_entries')
      .select('*')
      .eq('type', 'adiantamento')
      .gte('created_at', '2025-01-01T00:00:00')
      .lt('created_at', '2025-02-01T00:00:00');

    logInfo(`Despesas em Janeiro: ${despesas?.length || 0}`);
    logInfo(`Adiantamentos em Janeiro: ${adiantamentos?.length || 0}`);

    if (despesas && despesas.length > 0) {
      const totalDespesas = despesas.reduce((sum, d) => sum + (d.value || 0), 0);
      logInfo(`Total em despesas: R$ ${totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }

    if (adiantamentos && adiantamentos.length > 0) {
      const totalAdiantamentos = adiantamentos.reduce((sum, a) => sum + (a.value || 0), 0);
      logInfo(`Total em adiantamentos: R$ ${totalAdiantamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    }

  } catch (err) {
    logError(`Erro geral: ${err.message}`);
  }
}

async function verificarIntegridade() {
  logHeader('5. VERIFICANDO INTEGRIDADE DO SISTEMA');

  try {
    // Verificar rastreamento
    const { count: rastreamentoCount, error: erroRastreamento } = await supabase
      .from('rastreamento')
      .select('*', { count: 'exact', head: true });

    if (erroRastreamento) {
      logWarning(`Rastreamento: ${erroRastreamento.message}`);
    } else {
      logInfo(`Sistema de rastreamento: ${rastreamentoCount} registros`);
      if (rastreamentoCount === 0) {
        logWarning('Sistema de rastreamento não está em uso');
      } else {
        logSuccess('Sistema de rastreamento está ativo');
      }
    }

  } catch (err) {
    logError(`Erro geral: ${err.message}`);
  }
}

// ============================================================
// RESUMO FINAL
// ============================================================

async function exibirResumo() {
  logHeader('RESUMO FINAL');

  console.log(`
${colors.cyan}================== VERIFICAÇÃO CONCLUÍDA ==================${colors.reset}

${colors.bold}Banco Verificado:${colors.reset} honorario (PRODUÇÃO)
${colors.bold}Data:${colors.reset} 26 de Dezembro de 2025
${colors.bold}Hora:${colors.reset} ${new Date().toLocaleString('pt-BR')}

${colors.bold}Recomendações:${colors.reset}
1. ✅ Se nenhuma duplicata foi encontrada = Sistema OK
2. ⚠️  Se duplicatas foram encontradas = Investigar origem
3. 🔐 Aplicar PLANO_SEGURANCA_HONORARIO.md (URGENTE)
4. 📊 Considerar ativar rastreamento se desabilitado

${colors.cyan}===========================================================${colors.reset}
  `);
}

// ============================================================
// EXECUÇÃO PRINCIPAL
// ============================================================

async function main() {
  console.clear();
  log(colors.bold + colors.cyan, `
╔══════════════════════════════════════════════════════════╗
║   VERIFICAÇÃO DE DUPLICATAS - PROJETO HONORARIO         ║
║   Banco de Produção - 26/12/2025                        ║
╚══════════════════════════════════════════════════════════╝
  `);

  try {
    // Testar conexão
    const { data, error } = await supabase.auth.getSession();
    if (error && error.message !== 'Auth session missing!') {
      logError(`Erro ao conectar: ${error.message}`);
      process.exit(1);
    }
    logSuccess('Conectado ao banco "honorario"');

    // Executar verificações
    await verificarDuplicatasHoje();
    await verificarDuplicatas30Dias();
    await verificarTotalRegistros();
    await verificarDadosJaneiro();
    await verificarIntegridade();

    // Exibir resumo
    await exibirResumo();

  } catch (err) {
    logError(`Erro fatal: ${err.message}`);
    process.exit(1);
  }
}

main();
