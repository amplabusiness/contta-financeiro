# 🎯 MASTER: Correção do Sistema Contábil - Ampla Contabilidade

**Data:** 11/01/2026  
**Versão:** 1.0  
**Autor:** Análise conjunta Claude + Sérgio Carneiro Leão  
**Objetivo:** Corrigir duplicação de lançamentos e implementar arquitetura correta de conciliação

---

## 📋 ÍNDICE

1. [Diagnóstico do Problema](#1-diagnóstico-do-problema)
2. [Arquitetura Atual vs Proposta](#2-arquitetura-atual-vs-proposta)
3. [Plano de Execução](#3-plano-de-execução)
4. [Scripts de Correção](#4-scripts-de-correção)
5. [Modificações no Frontend](#5-modificações-no-frontend)
6. [Validações](#6-validações)

---

## 1. DIAGNÓSTICO DO PROBLEMA

### 1.1 Sintoma Principal
O saldo do Banco Sicredi no sistema está **inflado** em relação ao extrato OFX real:

| Fonte | Saldo Jan/2025 |
|-------|----------------|
| **OFX Sicredi (correto)** | R$ 18.553,54 |
| **Sistema (errado)** | R$ 128.843,13 |
| **Diferença** | R$ 110.289,59 |

### 1.2 Causa Raiz Identificada
Os lançamentos contábeis estão sendo criados **DUAS VEZES** para o mesmo dinheiro:

```
FLUXO ATUAL COM BUG:

1. Importa OFX → Cria lançamento:
   D - Banco Sicredi     R$ 5.913,78 (COB000005)
   C - Conta genérica    R$ 5.913,78

2. Script externo processa boletos → Cria OUTRO lançamento:
   D - Banco Sicredi     R$ 760,00 (Cliente A)
   C - Clientes Receber  R$ 760,00
   D - Banco Sicredi     R$ 300,00 (Cliente B)  ← DUPLICOU O DÉBITO!
   C - Clientes Receber  R$ 300,00

RESULTADO: O mesmo dinheiro entra 2x no banco no sistema
```

### 1.3 Evidência nos Dados (accounting_entry_lines)

| Source Type | Qtd Linhas | Débitos | Créditos | Saldo |
|-------------|------------|---------|----------|-------|
| bank_transaction | 4.224 | R$ 5.197.837,49 | R$ 3.697.581,13 | R$ 1.500.256,36 |
| boleto_sicredi | 1.000 | R$ 1.205.397,65 | R$ 0,00 | R$ 1.205.397,65 |
| ofx_import | 183 | R$ 298.527,29 | R$ 370.698,81 | R$ -72.171,52 |
| **TOTAL** | **5.408** | **R$ 6.792.487,49** | **R$ 4.068.279,94** | **R$ 2.724.207,55** |

Os `boleto_sicredi` (1.000 linhas) estão **duplicando** recebimentos já existentes em `bank_transaction`.

### 1.4 Problema Adicional: Lançamentos em Conta Sintética
A conta `1.1.2.01 (Clientes a Receber)` é **SINTÉTICA** (totalizadora), mas tem 4.024 lançamentos diretos.

**Violação NBC TG 26 / ITG 2000:** Contas sintéticas NÃO devem receber lançamentos diretos - apenas as analíticas (1.1.2.01.0001, 1.1.2.01.0002, etc).

---

## 2. ARQUITETURA ATUAL VS PROPOSTA

### 2.1 Arquitetura ATUAL (com problema)

```
┌────────────────────────────────────────────────────────────────┐
│ 1. GERAR HONORÁRIOS (dia 30)                                   │
│    D - 1.1.2.01 (sintética!) ← ERRADO                          │
│    C - 3.1.1.xx (Receita)                                      │
├────────────────────────────────────────────────────────────────┤
│ 2. IMPORTAR OFX                                                │
│    D - 1.1.1.05 (Banco Sicredi)                                │
│    C - ??? (conta genérica ou receita) ← IMPRECISO             │
├────────────────────────────────────────────────────────────────┤
│ 3. SCRIPTS EXTERNOS (gerar_lancamentos_boletos_v2.mjs)         │
│    D - 1.1.1.05 (Banco Sicredi) ← DUPLICA O DÉBITO!            │
│    C - 1.1.2.01.xxxx (Cliente)                                 │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Arquitetura PROPOSTA (correta)

```
┌────────────────────────────────────────────────────────────────┐
│ 1. GERAR HONORÁRIOS (dia 30) - Regime de Competência           │
│    D - 1.1.2.01.xxxx (Cliente ANALÍTICA)                       │
│    C - 3.1.1.xx (Receita de Honorários)                        │
│    ✅ Cria conta analítica automaticamente se não existir      │
├────────────────────────────────────────────────────────────────┤
│ 2. IMPORTAR OFX - Usa conta TRANSITÓRIA                        │
│    D - 1.1.1.05 (Banco Sicredi)                                │
│    C - 1.1.9.01 (Recebimentos a Conciliar) ← NOVA CONTA        │
│    ✅ Banco = OFX sempre!                                       │
├────────────────────────────────────────────────────────────────┤
│ 3. SUPER CONCILIAÇÃO - Desmembra por cliente                   │
│    Ao importar CSV de boletos:                                 │
│    D - 1.1.9.01 (Recebimentos a Conciliar) ← ESTORNA           │
│    C - 1.1.2.01.0001 (Cliente A)           R$ 760,00           │
│    C - 1.1.2.01.0002 (Cliente B)           R$ 300,00           │
│    ... demais clientes                                         │
│    ✅ Banco NÃO é tocado novamente (já foi no passo 2)         │
│    ✅ Clientes baixados individualmente                        │
└────────────────────────────────────────────────────────────────┘
```

### 2.3 Nova Conta a Criar

```sql
-- 1.1.9.01 - Recebimentos a Conciliar (conta transitória)
INSERT INTO chart_of_accounts (code, name, account_type, nature, is_synthetic, parent_code, is_active)
VALUES ('1.1.9.01', 'Recebimentos a Conciliar', 'ATIVO', 'DEVEDORA', false, '1.1.9', true);

-- Conta pai se não existir
INSERT INTO chart_of_accounts (code, name, account_type, nature, is_synthetic, parent_code, is_active)
VALUES ('1.1.9', 'Valores Transitórios', 'ATIVO', 'DEVEDORA', true, '1.1', true)
ON CONFLICT (code) DO NOTHING;
```

---

## 3. PLANO DE EXECUÇÃO

### FASE 1: PREPARAÇÃO (10 min)
- [ ] 1.1 Backup do banco de dados
- [ ] 1.2 Criar conta transitória 1.1.9.01
- [ ] 1.3 Verificar contas analíticas de clientes existentes

### FASE 2: LIMPEZA DA BASE JANEIRO/2025 (30 min)
- [ ] 2.1 Identificar lançamentos duplicados (boleto_sicredi)
- [ ] 2.2 Deletar lançamentos duplicados
- [ ] 2.3 Ajustar lançamentos OFX para usar conta transitória
- [ ] 2.4 Validar saldo do banco = OFX

### FASE 3: RECLASSIFICAR LANÇAMENTOS SINTÉTICOS (20 min)
- [ ] 3.1 Identificar lançamentos na conta 1.1.2.01 (sintética)
- [ ] 3.2 Criar contas analíticas por cliente
- [ ] 3.3 Mover lançamentos para contas analíticas

### FASE 4: MODIFICAR SUPER CONCILIAÇÃO (45 min)
- [ ] 4.1 Adicionar botão "Criar Conta no Plano de Contas"
- [ ] 4.2 Modificar lógica de conciliação para usar conta transitória
- [ ] 4.3 Implementar desmembramento automático por cliente

### FASE 5: VALIDAÇÃO FINAL (15 min)
- [ ] 5.1 Conferir equação contábil (Débitos = Créditos)
- [ ] 5.2 Conferir saldo do banco = OFX
- [ ] 5.3 Conferir que conta sintética 1.1.2.01 não tem lançamentos diretos
- [ ] 5.4 Gerar Balancete e DRE para validação

---

## 4. SCRIPTS DE CORREÇÃO

### 4.1 Script: Criar Conta Transitória

```javascript
// scripts/01_criar_conta_transitoria.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function criarContaTransitoria() {
  console.log('🔧 Criando conta transitória 1.1.9.01...\n');

  // 1. Verificar/criar conta pai 1.1.9
  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9')
    .maybeSingle();

  if (!contaPai) {
    const { error: errPai } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: '1.1.9',
        name: 'Valores Transitórios',
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        is_synthetic: true,
        parent_code: '1.1',
        is_active: true
      });
    
    if (errPai) {
      console.error('❌ Erro ao criar conta pai 1.1.9:', errPai);
      return;
    }
    console.log('✅ Conta pai 1.1.9 criada');
  } else {
    console.log('ℹ️ Conta pai 1.1.9 já existe');
  }

  // 2. Criar conta transitória 1.1.9.01
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .maybeSingle();

  if (!contaTransitoria) {
    const { error: errTrans } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: '1.1.9.01',
        name: 'Recebimentos a Conciliar',
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        is_synthetic: false,
        parent_code: '1.1.9',
        is_active: true,
        description: 'Conta transitória para recebimentos do OFX aguardando conciliação por cliente'
      });
    
    if (errTrans) {
      console.error('❌ Erro ao criar conta 1.1.9.01:', errTrans);
      return;
    }
    console.log('✅ Conta 1.1.9.01 (Recebimentos a Conciliar) criada');
  } else {
    console.log('ℹ️ Conta 1.1.9.01 já existe');
  }

  console.log('\n✅ Conta transitória configurada com sucesso!');
}

criarContaTransitoria();
```

### 4.2 Script: Identificar e Deletar Duplicatas

```javascript
// scripts/02_limpar_duplicatas_banco_sicredi.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Conta do Banco Sicredi
const BANCO_SICREDI_CODE = '1.1.1.05';

// Modo de execução: 'SIMULACAO' ou 'EXECUCAO'
const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

async function limparDuplicatas() {
  console.log(`\n🔍 MODO: ${MODO}\n`);
  console.log('=' .repeat(60));
  console.log('LIMPEZA DE DUPLICATAS - BANCO SICREDI');
  console.log('=' .repeat(60));

  // 1. Buscar conta do Banco Sicredi
  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', BANCO_SICREDI_CODE)
    .single();

  if (!contaBanco) {
    console.error(`❌ Conta ${BANCO_SICREDI_CODE} não encontrada!`);
    return;
  }

  console.log(`\n📍 Conta encontrada: ${contaBanco.code} - ${contaBanco.name}`);
  console.log(`   ID: ${contaBanco.id}\n`);

  // 2. Buscar todas as linhas do banco agrupadas por source_type
  const { data: linhas, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      entry_id,
      debit,
      credit,
      description,
      accounting_entries!inner (
        id,
        entry_date,
        description,
        reference_type,
        reference_id,
        source_type
      )
    `)
    .eq('account_id', contaBanco.id)
    .gte('accounting_entries.entry_date', '2025-01-01')
    .lte('accounting_entries.entry_date', '2025-01-31');

  if (error) {
    console.error('❌ Erro ao buscar linhas:', error);
    return;
  }

  console.log(`📊 Total de linhas encontradas: ${linhas.length}`);

  // 3. Agrupar por source_type
  const porSourceType = {};
  for (const linha of linhas) {
    const sourceType = linha.accounting_entries?.source_type || 'null';
    if (!porSourceType[sourceType]) {
      porSourceType[sourceType] = { linhas: [], debitos: 0, creditos: 0 };
    }
    porSourceType[sourceType].linhas.push(linha);
    porSourceType[sourceType].debitos += linha.debit || 0;
    porSourceType[sourceType].creditos += linha.credit || 0;
  }

  console.log('\n📈 RESUMO POR SOURCE_TYPE:');
  console.log('-'.repeat(80));
  console.log('Source Type'.padEnd(25) + 'Linhas'.padStart(10) + 'Débitos'.padStart(20) + 'Créditos'.padStart(20));
  console.log('-'.repeat(80));

  for (const [tipo, dados] of Object.entries(porSourceType)) {
    console.log(
      tipo.padEnd(25) +
      String(dados.linhas.length).padStart(10) +
      `R$ ${dados.debitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(20) +
      `R$ ${dados.creditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`.padStart(20)
    );
  }

  // 4. Identificar duplicatas (boleto_sicredi que duplicam bank_transaction)
  const duplicatas = porSourceType['boleto_sicredi']?.linhas || [];
  
  if (duplicatas.length === 0) {
    console.log('\n✅ Nenhuma duplicata boleto_sicredi encontrada!');
    return;
  }

  console.log(`\n🔴 DUPLICATAS IDENTIFICADAS: ${duplicatas.length} linhas de boleto_sicredi`);
  console.log(`   Total a remover: R$ ${porSourceType['boleto_sicredi'].debitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  // 5. Coletar IDs únicos de entries para deletar
  const entryIdsParaDeletar = [...new Set(duplicatas.map(l => l.entry_id))];
  console.log(`\n📋 Entries a deletar: ${entryIdsParaDeletar.length}`);

  if (MODO === 'SIMULACAO') {
    console.log('\n⚠️ MODO SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('   Para executar de verdade, rode: node scripts/02_limpar_duplicatas_banco_sicredi.mjs --executar');
    
    // Mostrar amostra
    console.log('\n📝 Amostra dos 10 primeiros lançamentos a deletar:');
    for (const linha of duplicatas.slice(0, 10)) {
      console.log(`   - ${linha.accounting_entries.entry_date} | ${linha.description?.substring(0, 50)} | R$ ${linha.debit?.toLocaleString('pt-BR')}`);
    }
    return;
  }

  // 6. EXECUÇÃO: Deletar
  console.log('\n🗑️ Deletando lançamentos duplicados...');

  // Primeiro deletar as linhas
  const { error: errLinhas } = await supabase
    .from('accounting_entry_lines')
    .delete()
    .in('entry_id', entryIdsParaDeletar);

  if (errLinhas) {
    console.error('❌ Erro ao deletar linhas:', errLinhas);
    return;
  }

  // Depois deletar os entries
  const { error: errEntries } = await supabase
    .from('accounting_entries')
    .delete()
    .in('id', entryIdsParaDeletar);

  if (errEntries) {
    console.error('❌ Erro ao deletar entries:', errEntries);
    return;
  }

  console.log(`\n✅ ${entryIdsParaDeletar.length} lançamentos duplicados removidos!`);

  // 7. Verificar saldo após limpeza
  const { data: linhasApos } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contaBanco.id);

  const saldoApos = linhasApos.reduce((acc, l) => acc + (l.debit || 0) - (l.credit || 0), 0);
  console.log(`\n📊 Saldo do banco após limpeza: R$ ${saldoApos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
}

limparDuplicatas();
```

### 4.3 Script: Reclassificar Lançamentos da Conta Sintética

```javascript
// scripts/03_reclassificar_sintetica_para_analiticas.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Conta sintética (NÃO deveria ter lançamentos)
const CONTA_SINTETICA_CODE = '1.1.2.01';

// Mapeamento de nomes de clientes (CSV -> Banco)
const MAPEAMENTO_CLIENTES = {
  'ALLIANCE EMPREENDIMENTOS LTDA': 'ALLIANCE EMPREENDIMETOS',
  'ELETROSOL SOLUCOES EM ENERGIA LTDA': 'ELETROSOL SOLUÇÕES EM ENCERGIA LTDA',
  'JR SOLUCOES INDUSTRIAIS LTDA': 'JR SOLUÇÕES INDUSTRIAIS LTDA',
  'L F GONCALVES CONFECCOES LTDA': 'L.F. GONCALVES CONFECCOES LTDA',
  'ACTION SOLUCOES INDUSTRIAIS LTDA': 'ACTION SOLUÇÕES INDUSTRIAIS LTDA',
  'UNICAIXAS DESPACHANTE LTDA': 'UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA',
  'KORSICA COMERCIO ATACADISTA DE PNEUS LTD': 'KORSICA COM ATAC DE PNEUS LTDA',
  'AMETISTA GESTAO EMPRESARIAL LTDA': 'AMETISTA GESTÃO EMPRESARIAL LTDA',
  'C.R.J MANUTENCAO EM AR CONDICIONADO LTDA': 'C.R.J MANUTENÇÃO EM AR CONDICIONADO LTDA',
  'CHRISTIANE RODRIGUES MACHADO LOPES LTDA': 'CHRISTIANE RODRIGEUS MACHADO',
  'ANAPOLIS SERVICOS DE VISTORIAS LTDA': 'ANAPOLIS VISTORIA LTDA',
  'CENTRO OESTE SERVICOS DE VISTORIAS LTDA': 'CENTRO OESTE SERVIÇO DE VISTORIA LTDA',
  'ARANTES NEGOCIOS LTDA': 'ARANTES NEGOCIOS EIRELI -ME',
  'CARVALHO E MELO ADM. E PARTIPA AO EIRELI': 'CARVALHO E MELO LTDA',
  'FORMA COMUNICA AO VISUAL LTDA-ME': 'FORMA COMUNICAÇÃO VISUAL LTDA ME',
  'MARCUS VINICIUS LEAL PIRES 75208709104': 'MARCUS VINICIUS LEAL PIRES - MEI',
  'PREMIER SOLU OES INDUSTRIAIS LTDA': 'PREMIER SOLUÇÕES INDUSTRIAL LTDA',
  'COVAS SERVICOS DE PINTURAS LTDA': 'COVAS SERVIÇOS DE PINTURAS LTDA',
  'FERNANDA COVAS DO VALE': 'FERNANDA COVAS VALE',
  'BCS MINAS SERVICOS MEDICOS LTDA': 'BCS MINAS SERVIÇOS MEDICOS LTDA',
  'BCS GOIAS SERVICOS MEDICOS LTDA': 'BCS GOIAS SERVIÇOS MEDICOS LTDA',
};

const MODO = process.argv[2] === '--executar' ? 'EXECUCAO' : 'SIMULACAO';

// Normalizar nome para busca
function normalizarNome(nome) {
  return (nome || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Extrair nome do cliente da descrição do lançamento
function extrairNomeCliente(descricao) {
  if (!descricao) return null;
  
  // Padrões comuns
  const padroes = [
    /Receita Honorarios:\s*(.+)/i,
    /Recebimento\s+(.+?)\s*-\s*COB/i,
    /Saldo Abertura\s*-\s*(.+)/i,
    /Débito:\s*(.+)/i,
    /Cliente:\s*(.+)/i,
    /^(.+?)\s*-\s*COB\d+/i,
  ];
  
  for (const padrao of padroes) {
    const match = descricao.match(padrao);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

async function reclassificarSintetica() {
  console.log(`\n🔍 MODO: ${MODO}\n`);
  console.log('='.repeat(70));
  console.log('RECLASSIFICAÇÃO: CONTA SINTÉTICA → CONTAS ANALÍTICAS');
  console.log('='.repeat(70));

  // 1. Buscar conta sintética
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .eq('code', CONTA_SINTETICA_CODE)
    .single();

  if (!contaSintetica) {
    console.error(`❌ Conta ${CONTA_SINTETICA_CODE} não encontrada!`);
    return;
  }

  console.log(`\n📍 Conta sintética: ${contaSintetica.code} - ${contaSintetica.name}`);

  // 2. Buscar linhas na conta sintética
  const { data: linhasSinteticas, error } = await supabase
    .from('accounting_entry_lines')
    .select(`
      id,
      entry_id,
      debit,
      credit,
      description,
      accounting_entries!inner (
        id,
        entry_date,
        description,
        reference_type,
        reference_id
      )
    `)
    .eq('account_id', contaSintetica.id);

  if (error) {
    console.error('❌ Erro ao buscar linhas:', error);
    return;
  }

  console.log(`\n📊 Linhas na conta sintética: ${linhasSinteticas.length}`);

  if (linhasSinteticas.length === 0) {
    console.log('✅ Nenhum lançamento na conta sintética! Já está correto.');
    return;
  }

  // 3. Buscar todos os clientes
  const { data: clientes } = await supabase
    .from('clients')
    .select('id, name');

  const clientesPorNome = new Map();
  for (const c of clientes) {
    clientesPorNome.set(normalizarNome(c.name), c);
    // Adicionar mapeamentos
    for (const [csvNome, bancoNome] of Object.entries(MAPEAMENTO_CLIENTES)) {
      if (normalizarNome(bancoNome) === normalizarNome(c.name)) {
        clientesPorNome.set(normalizarNome(csvNome), c);
      }
    }
  }

  // 4. Buscar contas analíticas existentes
  const { data: contasAnaliticas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.2.01.%');

  const contasPorNome = new Map();
  for (const conta of contasAnaliticas || []) {
    contasPorNome.set(normalizarNome(conta.name), conta);
  }

  console.log(`\n📋 Clientes cadastrados: ${clientes.length}`);
  console.log(`📋 Contas analíticas existentes: ${contasAnaliticas?.length || 0}`);

  // 5. Processar cada linha
  const alteracoes = [];
  const semCliente = [];
  let proximoCodigo = (contasAnaliticas?.length || 0) + 1;

  for (const linha of linhasSinteticas) {
    const descricao = linha.description || linha.accounting_entries?.description || '';
    const nomeExtraido = extrairNomeCliente(descricao);
    
    if (!nomeExtraido) {
      semCliente.push({ linha, motivo: 'Nome não extraído da descrição' });
      continue;
    }

    const nomeNorm = normalizarNome(nomeExtraido);
    const cliente = clientesPorNome.get(nomeNorm);

    if (!cliente) {
      semCliente.push({ linha, motivo: `Cliente não encontrado: ${nomeExtraido}` });
      continue;
    }

    // Verificar se já tem conta analítica
    let contaAnalitica = contasPorNome.get(normalizarNome(cliente.name));

    if (!contaAnalitica) {
      // Criar nova conta analítica
      const novoCodigo = `1.1.2.01.${String(proximoCodigo).padStart(4, '0')}`;
      proximoCodigo++;
      
      contaAnalitica = {
        id: null, // Será criada
        code: novoCodigo,
        name: cliente.name,
        nova: true
      };
      contasPorNome.set(normalizarNome(cliente.name), contaAnalitica);
    }

    alteracoes.push({
      linhaId: linha.id,
      clienteNome: cliente.name,
      contaAnalitica,
      valor: linha.debit || linha.credit,
      tipo: linha.debit ? 'D' : 'C'
    });
  }

  // 6. Relatório
  console.log('\n' + '='.repeat(70));
  console.log('RELATÓRIO DE ALTERAÇÕES');
  console.log('='.repeat(70));
  console.log(`\n✅ Linhas a reclassificar: ${alteracoes.length}`);
  console.log(`❌ Linhas sem cliente identificado: ${semCliente.length}`);

  // Contas novas a criar
  const contasNovas = alteracoes.filter(a => a.contaAnalitica.nova);
  const contasUnicas = [...new Set(contasNovas.map(a => a.contaAnalitica.code))];
  console.log(`\n📝 Novas contas analíticas a criar: ${contasUnicas.length}`);

  if (MODO === 'SIMULACAO') {
    console.log('\n⚠️ MODO SIMULAÇÃO - Nenhuma alteração foi feita');
    console.log('   Para executar de verdade, rode: node scripts/03_reclassificar_sintetica_para_analiticas.mjs --executar');
    
    // Mostrar amostra
    console.log('\n📝 Amostra das 10 primeiras reclassificações:');
    for (const alt of alteracoes.slice(0, 10)) {
      console.log(`   ${alt.tipo} R$ ${alt.valor?.toLocaleString('pt-BR')} → ${alt.contaAnalitica.code} (${alt.clienteNome.substring(0, 30)})`);
    }

    if (semCliente.length > 0) {
      console.log('\n⚠️ Linhas sem cliente (primeiras 10):');
      for (const { linha, motivo } of semCliente.slice(0, 10)) {
        console.log(`   - ${linha.description?.substring(0, 50)} | ${motivo}`);
      }
    }
    return;
  }

  // 7. EXECUÇÃO
  console.log('\n🔧 Executando alterações...');

  // 7.1 Criar contas analíticas novas
  for (const codigo of contasUnicas) {
    const alt = alteracoes.find(a => a.contaAnalitica.code === codigo);
    const { error: errConta } = await supabase
      .from('chart_of_accounts')
      .insert({
        code: alt.contaAnalitica.code,
        name: alt.clienteNome,
        account_type: 'ATIVO',
        nature: 'DEVEDORA',
        is_synthetic: false,
        parent_code: '1.1.2.01',
        is_active: true
      });

    if (errConta) {
      console.error(`❌ Erro ao criar conta ${alt.contaAnalitica.code}:`, errConta);
    } else {
      console.log(`✅ Conta criada: ${alt.contaAnalitica.code} - ${alt.clienteNome}`);
    }
  }

  // 7.2 Buscar IDs das contas recém-criadas
  const { data: contasAtualizadas } = await supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.2.01.%');

  const contasIdPorCodigo = new Map();
  for (const conta of contasAtualizadas || []) {
    contasIdPorCodigo.set(conta.code, conta.id);
  }

  // 7.3 Atualizar linhas para apontar para contas analíticas
  let atualizadas = 0;
  for (const alt of alteracoes) {
    const contaId = contasIdPorCodigo.get(alt.contaAnalitica.code);
    if (!contaId) {
      console.error(`❌ Conta ${alt.contaAnalitica.code} não encontrada após criação`);
      continue;
    }

    const { error: errUpdate } = await supabase
      .from('accounting_entry_lines')
      .update({ account_id: contaId })
      .eq('id', alt.linhaId);

    if (errUpdate) {
      console.error(`❌ Erro ao atualizar linha ${alt.linhaId}:`, errUpdate);
    } else {
      atualizadas++;
    }
  }

  console.log(`\n✅ ${atualizadas} linhas reclassificadas com sucesso!`);
}

reclassificarSintetica();
```

### 4.4 Script: Validar Equação Contábil

```javascript
// scripts/04_validar_equacao_contabil.mjs
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function validarEquacaoContabil() {
  console.log('\n' + '='.repeat(70));
  console.log('VALIDAÇÃO DA EQUAÇÃO CONTÁBIL');
  console.log('='.repeat(70));

  // 1. Somar todos os débitos e créditos
  const { data: totais } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit');

  const totalDebitos = totais.reduce((acc, l) => acc + (l.debit || 0), 0);
  const totalCreditos = totais.reduce((acc, l) => acc + (l.credit || 0), 0);
  const diferenca = Math.abs(totalDebitos - totalCreditos);

  console.log(`\n📊 TOTAIS GERAIS:`);
  console.log(`   Total Débitos:  R$ ${totalDebitos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Total Créditos: R$ ${totalCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
  console.log(`   Diferença:      R$ ${diferenca.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);

  if (diferenca < 0.01) {
    console.log('\n✅ EQUAÇÃO CONTÁBIL VÁLIDA! (Débitos = Créditos)');
  } else {
    console.log('\n❌ EQUAÇÃO CONTÁBIL INVÁLIDA! Diferença encontrada.');
  }

  // 2. Verificar saldo do Banco Sicredi
  const { data: contaBanco } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.1.05')
    .single();

  if (contaBanco) {
    const { data: linhasBanco } = await supabase
      .from('accounting_entry_lines')
      .select('debit, credit')
      .eq('account_id', contaBanco.id);

    const saldoBanco = linhasBanco.reduce((acc, l) => acc + (l.debit || 0) - (l.credit || 0), 0);
    
    console.log(`\n📍 SALDO BANCO SICREDI (1.1.1.05):`);
    console.log(`   Saldo atual: R$ ${saldoBanco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    console.log(`   Saldo OFX (Jan/2025): R$ 18.553,54`);
    
    if (Math.abs(saldoBanco - 18553.54) < 1) {
      console.log('\n✅ SALDO DO BANCO CONFERE COM OFX!');
    } else {
      console.log('\n⚠️ Saldo do banco difere do OFX. Verificar lançamentos.');
    }
  }

  // 3. Verificar conta sintética 1.1.2.01
  const { data: contaSintetica } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  if (contaSintetica) {
    const { data: linhasSintetica, count } = await supabase
      .from('accounting_entry_lines')
      .select('id', { count: 'exact' })
      .eq('account_id', contaSintetica.id);

    console.log(`\n📍 CONTA SINTÉTICA 1.1.2.01 (Clientes a Receber):`);
    console.log(`   Lançamentos diretos: ${count || 0}`);
    
    if (count === 0) {
      console.log('\n✅ CORRETO! Conta sintética sem lançamentos diretos.');
    } else {
      console.log('\n❌ VIOLAÇÃO NBC TG 26! Conta sintética com lançamentos diretos.');
    }
  }

  console.log('\n' + '='.repeat(70));
}

validarEquacaoContabil();
```

---

## 5. MODIFICAÇÕES NO FRONTEND

### 5.1 Adicionar Botão "Criar Conta" na Super Conciliação

Modificar o arquivo `src/pages/SuperConciliation.tsx`:

```typescript
// Adicionar após a linha ~1370 (dentro do CollectionClientBreakdown)

// Novo componente para criar conta no plano de contas
function CriarContaDialog({ 
  nomeCliente, 
  onContaCriada 
}: { 
  nomeCliente: string; 
  onContaCriada: (conta: { code: string; id: string }) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleCriar = async () => {
    setLoading(true);
    try {
      // Buscar próximo código disponível
      const { data: contas } = await supabase
        .from('chart_of_accounts')
        .select('code')
        .ilike('code', '1.1.2.01.%')
        .order('code', { ascending: false })
        .limit(1);

      const ultimoCodigo = contas?.[0]?.code || '1.1.2.01.0000';
      const numeroAtual = parseInt(ultimoCodigo.split('.').pop() || '0');
      const novoCodigo = `1.1.2.01.${String(numeroAtual + 1).padStart(4, '0')}`;

      // Criar conta
      const { data: novaConta, error } = await supabase
        .from('chart_of_accounts')
        .insert({
          code: novoCodigo,
          name: nomeCliente,
          account_type: 'ATIVO',
          nature: 'DEVEDORA',
          is_synthetic: false,
          parent_code: '1.1.2.01',
          is_active: true
        })
        .select('id, code')
        .single();

      if (error) throw error;

      toast.success(`Conta ${novoCodigo} criada com sucesso!`);
      onContaCriada(novaConta);
    } catch (err: any) {
      toast.error(`Erro ao criar conta: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleCriar}
      disabled={loading}
      className="h-6 text-[10px] gap-1"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
      Criar Conta
    </Button>
  );
}
```

### 5.2 Modificar Importação OFX para Usar Conta Transitória

Modificar o arquivo `src/pages/BankImport.tsx` na função `processWithAI`:

```typescript
// Modificar a chamada da Edge Function (linha ~229)
const { data, error } = await supabase.functions.invoke('ai-bank-transaction-processor', {
  body: {
    action: 'process_transactions',
    transactions: txnsForAI,
    bank_account_id: selectedAccount,
    import_id: importId,
    opening_date: '2024-12-31',
    // NOVA CONFIGURAÇÃO: Usar conta transitória para recebimentos
    use_transitoria: true,
    conta_transitoria_code: '1.1.9.01'
  }
});
```

### 5.3 Criar Edge Function para Desmembramento

Criar arquivo `supabase/functions/conciliar-cobranca/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      cobranca_doc,           // Ex: "COB000027"
      transaction_date,       // Data da transação OFX
      clientes                // Array de { client_id, client_name, amount, account_code }
    } = await req.json();

    // 1. Buscar conta transitória
    const { data: contaTransitoria } = await supabase
      .from('chart_of_accounts')
      .select('id')
      .eq('code', '1.1.9.01')
      .single();

    if (!contaTransitoria) {
      throw new Error('Conta transitória 1.1.9.01 não encontrada');
    }

    // 2. Calcular total
    const totalRecebido = clientes.reduce((acc: number, c: any) => acc + c.amount, 0);

    // 3. Criar lançamento de desmembramento
    const { data: entry, error: errEntry } = await supabase
      .from('accounting_entries')
      .insert({
        entry_date: transaction_date,
        entry_type: 'recebimento',
        description: `Desmembramento ${cobranca_doc} - ${clientes.length} clientes`,
        reference_type: 'cobranca_desmembramento',
        reference_id: cobranca_doc,
        source_type: 'super_conciliacao'
      })
      .select('id')
      .single();

    if (errEntry) throw errEntry;

    // 4. Criar linhas - Débito na transitória (estorno)
    const linhas = [
      {
        entry_id: entry.id,
        account_id: contaTransitoria.id,
        debit: totalRecebido,
        credit: 0,
        description: `Estorno transitória - ${cobranca_doc}`
      }
    ];

    // 5. Criar linhas - Crédito em cada cliente
    for (const cliente of clientes) {
      // Buscar conta do cliente
      const { data: contaCliente } = await supabase
        .from('chart_of_accounts')
        .select('id')
        .eq('code', cliente.account_code)
        .single();

      if (!contaCliente) {
        console.warn(`Conta ${cliente.account_code} não encontrada para ${cliente.client_name}`);
        continue;
      }

      linhas.push({
        entry_id: entry.id,
        account_id: contaCliente.id,
        debit: 0,
        credit: cliente.amount,
        description: `Baixa ${cliente.client_name} - ${cobranca_doc}`
      });
    }

    // 6. Inserir todas as linhas
    const { error: errLinhas } = await supabase
      .from('accounting_entry_lines')
      .insert(linhas);

    if (errLinhas) throw errLinhas;

    return new Response(
      JSON.stringify({
        success: true,
        entry_id: entry.id,
        linhas_criadas: linhas.length,
        total_desmembrado: totalRecebido
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

---

## 6. VALIDAÇÕES

### 6.1 Checklist Pós-Correção

```
□ Equação contábil válida (Débitos = Créditos)
□ Saldo Banco Sicredi = R$ 18.553,54 (OFX Jan/2025)
□ Conta sintética 1.1.2.01 sem lançamentos diretos
□ Conta transitória 1.1.9.01 com saldo zero (após conciliação completa)
□ Balancete fecha corretamente
□ DRE mostra receitas corretamente
□ Não há lançamentos source_type='boleto_sicredi' (duplicatas removidas)
```

### 6.2 Queries de Validação

```sql
-- 1. Verificar equação contábil
SELECT 
  SUM(debit) as total_debitos,
  SUM(credit) as total_creditos,
  SUM(debit) - SUM(credit) as diferenca
FROM accounting_entry_lines;

-- 2. Verificar saldo do banco
SELECT 
  SUM(debit) - SUM(credit) as saldo
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.1.05';

-- 3. Verificar lançamentos na conta sintética
SELECT COUNT(*) as lancamentos_sintetica
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.2.01';

-- 4. Verificar source_types
SELECT 
  ae.source_type,
  COUNT(*) as qtd,
  SUM(ael.debit) as debitos,
  SUM(ael.credit) as creditos
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
GROUP BY ae.source_type
ORDER BY qtd DESC;
```

---

## 📝 ORDEM DE EXECUÇÃO

```bash
# 1. Criar conta transitória
node scripts/01_criar_conta_transitoria.mjs

# 2. Limpar duplicatas (primeiro em SIMULAÇÃO)
node scripts/02_limpar_duplicatas_banco_sicredi.mjs

# 2b. Se a simulação estiver OK, executar de verdade
node scripts/02_limpar_duplicatas_banco_sicredi.mjs --executar

# 3. Reclassificar sintética (primeiro em SIMULAÇÃO)
node scripts/03_reclassificar_sintetica_para_analiticas.mjs

# 3b. Se a simulação estiver OK, executar de verdade
node scripts/03_reclassificar_sintetica_para_analiticas.mjs --executar

# 4. Validar resultado
node scripts/04_validar_equacao_contabil.mjs
```

---

## 🔒 BACKUP

**IMPORTANTE:** Antes de executar qualquer script com `--executar`, faça backup:

```bash
# Via Supabase CLI
supabase db dump -f backup_antes_correcao.sql

# Ou via psql
pg_dump -h <host> -U postgres -d postgres > backup_antes_correcao.sql
```

---

**Fim do documento MASTER**

*Gerado em 11/01/2026 - Sessão de análise Claude + Sérgio*
