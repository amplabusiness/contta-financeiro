# 🏗️ ARQUITETURA: SISTEMA CONTÁBIL AUTOMATIZADO AMPLA

**Versão:** 3.0  
**Data:** 11/01/2026  
**Objetivo:** Automatizar 100% do fluxo contábil com proteção contra erros

---

## 📋 ÍNDICE

1. [Visão Geral da Arquitetura](#1-visão-geral)
2. [Papéis e Responsabilidades](#2-papéis-e-responsabilidades)
3. [Fluxo Automatizado Completo](#3-fluxo-automatizado)
4. [Edge Functions Necessárias](#4-edge-functions)
5. [MCP como Guardião](#5-mcp-guardião)
6. [Dr. Cícero como Orquestrador](#6-dr-cícero)
7. [Implementação Técnica](#7-implementação)

---

## 1. VISÃO GERAL

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SISTEMA CONTÁBIL AMPLA                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐              │
│   │   USUÁRIO   │     │  DR. CÍCERO │     │     MCP     │              │
│   │  (Sérgio)   │     │ (Assistente)│     │ (Guardião)  │              │
│   └──────┬──────┘     └──────┬──────┘     └──────┬──────┘              │
│          │                   │                   │                      │
│          │ Upload OFX        │ Orienta           │ Valida               │
│          │ Gera boletos      │ Executa           │ Protege              │
│          ▼                   ▼                   ▼                      │
│   ┌─────────────────────────────────────────────────────────┐          │
│   │                    SUPABASE                              │          │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │          │
│   │  │   Storage   │  │    Edge     │  │  Database   │      │          │
│   │  │   (OFX)     │→→│  Functions  │→→│  (Contas)   │      │          │
│   │  └─────────────┘  └─────────────┘  └─────────────┘      │          │
│   └─────────────────────────────────────────────────────────┘          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PAPÉIS E RESPONSABILIDADES

### 🤖 MCP FINANCEIRO (Guardião)

**Função:** Proteger a aplicação, validar TUDO antes de executar

```
┌────────────────────────────────────────────────────────────┐
│ MCP FINANCEIRO - O GUARDIÃO                                │
├────────────────────────────────────────────────────────────┤
│ ✓ Valida TODA operação antes de executar                   │
│ ✓ Rejeita lançamentos em contas sintéticas                 │
│ ✓ Verifica idempotência (evita duplicações)                │
│ ✓ Garante Débito = Crédito                                 │
│ ✓ Ensina qualquer IA o fluxo correto                       │
│ ✓ Expõe ferramentas padronizadas                           │
└────────────────────────────────────────────────────────────┘
```

**Analogia:** MCP é como um **contador-chefe** que revisa tudo antes de assinar.

---

### 👨‍⚖️ DR. CÍCERO (Orquestrador)

**Função:** Assistir o usuário, orquestrar o fluxo, tomar decisões

```
┌────────────────────────────────────────────────────────────┐
│ DR. CÍCERO - O ORQUESTRADOR                                │
├────────────────────────────────────────────────────────────┤
│ ✓ Interpreta intenção do usuário                           │
│ ✓ Chama as ferramentas do MCP                              │
│ ✓ Identifica clientes em transações                        │
│ ✓ Sugere classificações para despesas                      │
│ ✓ Resolve conflitos e exceções                             │
│ ✓ Explica o que está fazendo                               │
└────────────────────────────────────────────────────────────┘
```

**Analogia:** Dr. Cícero é como um **auxiliar contábil experiente** que faz o trabalho.

---

### ⚡ EDGE FUNCTIONS (Automação)

**Função:** Executar processamento pesado sem intervenção humana

```
┌────────────────────────────────────────────────────────────┐
│ EDGE FUNCTIONS - A AUTOMAÇÃO                               │
├────────────────────────────────────────────────────────────┤
│ ✓ Processa arquivos OFX automaticamente                    │
│ ✓ Decodifica cobranças agrupadas                           │
│ ✓ Identifica clientes por padrões                          │
│ ✓ Cria lançamentos em massa                                │
│ ✓ Dispara webhooks e notificações                          │
└────────────────────────────────────────────────────────────┘
```

**Analogia:** Edge Functions são como **robôs de automação** que trabalham 24/7.

---

## 3. FLUXO AUTOMATIZADO COMPLETO

### 📊 DIAGRAMA DO FLUXO

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     FLUXO CONTÁBIL AUTOMATIZADO                         │
└─────────────────────────────────────────────────────────────────────────┘

FASE 1: PROVISÃO (Todo dia 30)
══════════════════════════════
     ┌──────────┐
     │ Trigger  │ ← Cron job dia 30
     │ Mensal   │
     └────┬─────┘
          │
          ▼
     ┌──────────────────┐     ┌──────────────────┐
     │ Edge Function:   │────▶│ Para cada cliente│
     │ gerar-honorarios │     │ ativo            │
     └──────────────────┘     └────────┬─────────┘
                                       │
                              ┌────────▼─────────┐
                              │ LANÇAMENTO:      │
                              │ D - 1.1.2.01.xxx │ ← Conta do cliente
                              │ C - 3.1.1.01     │ ← Receita
                              └──────────────────┘

FASE 2: EMISSÃO DE BOLETOS (Após provisão)
══════════════════════════════════════════
     ┌──────────────────┐
     │ Edge Function:   │────▶ Gera boletos no Sicredi
     │ emitir-boletos   │────▶ Agrupa em cobrança (COB000xxx)
     └──────────────────┘────▶ Salva arquivo de retorno

FASE 3: IMPORTAÇÃO OFX (Usuário faz upload)
═══════════════════════════════════════════
     ┌──────────┐
     │ Usuário  │ ← Upload do arquivo OFX
     │ Upload   │
     └────┬─────┘
          │
          ▼
     ┌──────────────────┐
     │ Supabase Storage │ ← Salva em /ofx/{data}/{arquivo}.ofx
     │ Bucket: imports  │
     └────────┬─────────┘
              │
              │ Trigger automático
              ▼
     ┌──────────────────┐
     │ Edge Function:   │
     │ processar-ofx    │
     └────────┬─────────┘
              │
              ├──────────────────────────────────────┐
              │                                      │
              ▼                                      ▼
     ┌──────────────────┐               ┌──────────────────┐
     │ É cobrança       │               │ É transação      │
     │ agrupada?        │               │ individual?      │
     │ (COB000xxx)      │               │ (PIX, TED, etc)  │
     └────────┬─────────┘               └────────┬─────────┘
              │ SIM                              │
              ▼                                  ▼
     ┌──────────────────┐               ┌──────────────────┐
     │ LANÇAMENTO:      │               │ Identificar      │
     │ D - 1.1.1.05     │ ← Banco       │ cliente          │
     │ C - 1.1.9.01     │ ← Transitória └────────┬─────────┘
     └────────┬─────────┘                        │
              │                                  ├─── Identificado?
              │                                  │
              ▼                                  ▼ SIM
     ┌──────────────────┐               ┌──────────────────┐
     │ Aguarda          │               │ LANÇAMENTO:      │
     │ desmembramento   │               │ D - 1.1.1.05     │ ← Banco
     └──────────────────┘               │ C - 1.1.2.01.xxx │ ← Cliente
                                        └──────────────────┘
                                                 │
                                                 ▼ NÃO
                                        ┌──────────────────┐
                                        │ LANÇAMENTO:      │
                                        │ D - 1.1.1.05     │ ← Banco
                                        │ C - 1.1.2.01.9999│ ← Pendente
                                        └──────────────────┘

FASE 4: DESMEMBRAMENTO (Automático ou via Super Conciliação)
════════════════════════════════════════════════════════════
     ┌──────────────────┐
     │ Arquivo retorno  │ ← CSV do Sicredi com boletos pagos
     │ Sicredi          │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │ Edge Function:   │
     │ desmembrar-cob   │
     └────────┬─────────┘
              │
              │ Para cada cliente no arquivo
              ▼
     ┌──────────────────────────────────────────┐
     │ LANÇAMENTO ÚNICO:                        │
     │ D - 1.1.9.01 (Transitória)    R$ 5.913   │ ← Estorno total
     │ C - 1.1.2.01.0001 (Cliente A) R$   760   │
     │ C - 1.1.2.01.0002 (Cliente B) R$   300   │
     │ C - 1.1.2.01.0003 (Cliente C) R$   500   │
     │ ...                                      │
     └──────────────────────────────────────────┘

FASE 5: DESPESAS (Cada uma na sua conta)
════════════════════════════════════════
     ┌──────────────────┐
     │ Transação OFX    │ ← Débito identificado
     │ tipo: DESPESA    │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────┐
     │ IA classifica    │ ← Baseado em descrição + histórico
     │ por categoria    │
     └────────┬─────────┘
              │
              ▼
     ┌──────────────────────────────────────────┐
     │ LANÇAMENTO:                              │
     │ D - 4.x.x.xx (Despesa específica)        │ ← Conta de despesa
     │ C - 1.1.1.05 (Banco)                     │
     └──────────────────────────────────────────┘

     EXEMPLOS DE CONTAS DE DESPESA:
     4.1.1.01 - Energia Elétrica
     4.1.1.02 - Água e Esgoto
     4.1.1.03 - Telefone/Internet
     4.1.2.01 - Material de Escritório
     4.1.3.01 - Honorários Advocatícios
     4.1.3.02 - Serviços de TI
     etc.
```

---

## 4. EDGE FUNCTIONS NECESSÁRIAS

### 4.1 `processar-ofx` (Principal)

**Trigger:** Upload de arquivo no Storage

```typescript
// supabase/functions/processar-ofx/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';

serve(async (req) => {
  const { bucket, name: filePath } = await req.json();
  
  // 1. Baixar arquivo OFX do Storage
  const ofxContent = await downloadFromStorage(bucket, filePath);
  
  // 2. Parsear OFX
  const transacoes = parseOFX(ofxContent);
  
  // 3. Processar cada transação
  for (const tx of transacoes) {
    await processarTransacao(tx);
  }
  
  return new Response(JSON.stringify({ success: true }));
});

async function processarTransacao(tx: Transacao) {
  // Verificar idempotência
  const existe = await verificarSeExiste(tx.fitid);
  if (existe) return;
  
  // Classificar transação
  const classificacao = await classificarTransacao(tx);
  
  // Criar lançamento via MCP (com validação)
  await mcp.criarLancamento({
    tipo: classificacao.tipo,
    linhas: classificacao.linhas,
    referenceId: tx.fitid,
    referenceType: 'bank_transaction'
  });
}

async function classificarTransacao(tx: Transacao) {
  // Cobrança agrupada?
  if (/COB\d+|COBRANCA|LIQ\.COB/i.test(tx.memo)) {
    return {
      tipo: 'cobranca_agrupada',
      linhas: [
        { conta: '1.1.1.05', debito: tx.amount, credito: 0 },
        { conta: '1.1.9.01', debito: 0, credito: tx.amount }
      ],
      precisaDesmembramento: true,
      cobrancaId: extrairCobrancaId(tx.memo)
    };
  }
  
  // Recebimento identificável (PIX, TED)?
  if (tx.amount > 0) {
    const cliente = await identificarCliente(tx.memo);
    if (cliente) {
      return {
        tipo: 'recebimento_identificado',
        linhas: [
          { conta: '1.1.1.05', debito: tx.amount, credito: 0 },
          { conta: cliente.contaCode, debito: 0, credito: tx.amount }
        ]
      };
    }
    // Não identificado
    return {
      tipo: 'recebimento_pendente',
      linhas: [
        { conta: '1.1.1.05', debito: tx.amount, credito: 0 },
        { conta: '1.1.2.01.9999', debito: 0, credito: tx.amount }
      ]
    };
  }
  
  // Despesa
  if (tx.amount < 0) {
    const categoria = await classificarDespesa(tx.memo, Math.abs(tx.amount));
    return {
      tipo: 'despesa',
      linhas: [
        { conta: categoria.contaCode, debito: Math.abs(tx.amount), credito: 0 },
        { conta: '1.1.1.05', debito: 0, credito: Math.abs(tx.amount) }
      ]
    };
  }
}
```

---

### 4.2 `desmembrar-cobranca`

**Trigger:** Upload de arquivo de retorno do Sicredi OU chamada manual

```typescript
// supabase/functions/desmembrar-cobranca/index.ts

serve(async (req) => {
  const { cobrancaId, arquivoRetorno } = await req.json();
  
  // 1. Parsear arquivo de retorno
  const boletos = parseArquivoRetorno(arquivoRetorno);
  
  // 2. Agrupar por cobrança
  const porCobranca = agruparPorCobranca(boletos);
  
  // 3. Para cada cobrança agrupada
  for (const [cobId, clientesBoletos] of Object.entries(porCobranca)) {
    // Verificar se já foi desmembrada
    const jaDesmembrada = await verificarDesmembramento(cobId);
    if (jaDesmembrada) continue;
    
    // Calcular total
    const total = clientesBoletos.reduce((s, b) => s + b.valor, 0);
    
    // Montar linhas do lançamento
    const linhas = [
      // Débito na transitória (estorno)
      { conta: '1.1.9.01', debito: total, credito: 0 },
      // Créditos nos clientes
      ...await Promise.all(clientesBoletos.map(async b => {
        const contaCliente = await getOuCriarContaCliente(b.clienteId);
        return { conta: contaCliente.code, debito: 0, credito: b.valor };
      }))
    ];
    
    // Criar lançamento via MCP
    await mcp.criarLancamento({
      tipo: 'desmembramento',
      linhas,
      referenceId: cobId,
      referenceType: 'cobranca_desmembramento',
      descricao: `Desmembramento ${cobId} - ${clientesBoletos.length} clientes`
    });
  }
  
  return new Response(JSON.stringify({ success: true }));
});
```

---

### 4.3 `gerar-honorarios`

**Trigger:** Cron job (dia 30 de cada mês)

```typescript
// supabase/functions/gerar-honorarios/index.ts

serve(async (req) => {
  const { competencia } = await req.json(); // YYYY-MM
  
  // 1. Buscar clientes ativos com honorários
  const clientes = await getClientesAtivos();
  
  // 2. Para cada cliente
  for (const cliente of clientes) {
    // Verificar se já gerou (idempotência)
    const jaGerou = await verificarHonorarios(cliente.id, competencia);
    if (jaGerou) continue;
    
    // Buscar ou criar conta analítica
    const contaCliente = await getOuCriarContaCliente(cliente.id);
    
    // Criar lançamento via MCP
    await mcp.criarLancamento({
      tipo: 'receita_honorarios',
      linhas: [
        { conta: contaCliente.code, debito: cliente.valorHonorarios, credito: 0 },
        { conta: '3.1.1.01', debito: 0, credito: cliente.valorHonorarios }
      ],
      referenceId: `hon_${cliente.id}_${competencia}`,
      referenceType: 'honorarios',
      descricao: `Honorários ${competencia} - ${cliente.name}`
    });
    
    // Criar invoice para emissão de boleto
    await criarInvoice(cliente.id, competencia, cliente.valorHonorarios);
  }
  
  return new Response(JSON.stringify({ 
    success: true, 
    clientesProcessados: clientes.length 
  }));
});
```

---

### 4.4 `classificar-despesas`

**Função:** IA que classifica despesas por categoria

```typescript
// supabase/functions/classificar-despesas/index.ts

const PADROES_DESPESA = [
  { pattern: /CELESC|CPFL|ENEL|ENERGIA|LUZ/i, conta: '4.1.1.01', nome: 'Energia Elétrica' },
  { pattern: /SANEPAR|COPASA|SABESP|AGUA/i, conta: '4.1.1.02', nome: 'Água e Esgoto' },
  { pattern: /VIVO|CLARO|TIM|OI|TELEFON|INTERNET/i, conta: '4.1.1.03', nome: 'Telefone/Internet' },
  { pattern: /PAPEL|CANETA|ESCRITORIO|KALUNGA/i, conta: '4.1.2.01', nome: 'Material de Escritório' },
  { pattern: /UBER|99|TAXI|COMBUSTIVEL|POSTO|SHELL|IPIRANGA/i, conta: '4.1.2.02', nome: 'Transporte/Combustível' },
  { pattern: /RESTAURANTE|ALMOCO|IFOOD|REFEICAO/i, conta: '4.1.2.03', nome: 'Alimentação' },
  { pattern: /GOOGLE|MICROSOFT|ADOBE|SOFTWARE|AWS|AZURE/i, conta: '4.1.3.01', nome: 'Software/Licenças' },
  { pattern: /ALUGUEL|LOCACAO/i, conta: '4.1.4.01', nome: 'Aluguel' },
  { pattern: /INSS|FGTS|FOLHA|SALARIO/i, conta: '4.2.1.01', nome: 'Folha de Pagamento' },
  // Mais padrões...
];

async function classificarDespesa(descricao: string, valor: number) {
  // 1. Tentar por padrão conhecido
  for (const padrao of PADROES_DESPESA) {
    if (padrao.pattern.test(descricao)) {
      return { contaCode: padrao.conta, nome: padrao.nome, confianca: 'alta' };
    }
  }
  
  // 2. Buscar histórico de classificações similares
  const historico = await buscarHistoricoSimilar(descricao);
  if (historico) {
    return { contaCode: historico.conta, nome: historico.nome, confianca: 'media' };
  }
  
  // 3. IA classifica (Claude via API)
  const classificacaoIA = await claudioClassifica(descricao, valor);
  if (classificacaoIA) {
    return { ...classificacaoIA, confianca: 'ia' };
  }
  
  // 4. Conta genérica (precisa revisão manual)
  return { 
    contaCode: '4.9.9.01', 
    nome: 'Outras Despesas (Classificar)', 
    confianca: 'baixa',
    precisaRevisao: true
  };
}
```

---

## 5. MCP COMO GUARDIÃO

### 5.1 Middleware de Validação

```typescript
// mcp-financeiro/src/middleware/validador.ts

export async function validarAntesDeExecutar(operacao: Operacao): Promise<ValidationResult> {
  const erros: string[] = [];
  const avisos: string[] = [];

  // REGRA 1: Conta sintética
  for (const linha of operacao.linhas) {
    const conta = await getConta(linha.contaCode);
    if (conta.is_synthetic || conta.code === '1.1.2.01') {
      erros.push(`BLOQUEADO: Conta ${conta.code} é SINTÉTICA. Use conta analítica.`);
    }
  }

  // REGRA 2: Partidas dobradas
  const totalDebitos = operacao.linhas.reduce((s, l) => s + (l.debito || 0), 0);
  const totalCreditos = operacao.linhas.reduce((s, l) => s + (l.credito || 0), 0);
  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    erros.push(`BLOQUEADO: Débitos (${totalDebitos}) ≠ Créditos (${totalCreditos})`);
  }

  // REGRA 3: Idempotência
  if (operacao.referenceId) {
    const existe = await verificarExistente(operacao.referenceType, operacao.referenceId);
    if (existe) {
      erros.push(`BLOQUEADO: Já existe lançamento com referenceId=${operacao.referenceId}`);
    }
  } else {
    avisos.push('AVISO: referenceId não informado - risco de duplicação');
  }

  // REGRA 4: Cobrança agrupada deve ir para transitória
  if (operacao.tipo === 'recebimento' && isCobrancaAgrupada(operacao.descricao)) {
    const usaTransitoria = operacao.linhas.some(l => l.contaCode === '1.1.9.01');
    if (!usaTransitoria) {
      erros.push('BLOQUEADO: Cobrança agrupada deve creditar conta transitória 1.1.9.01');
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos,
    podeExecutar: erros.length === 0
  };
}
```

### 5.2 Ferramentas Expostas pelo MCP

```typescript
// mcp-financeiro/src/tools/index.ts

export const tools = {
  // ===== CONSULTAS =====
  buscar_conta_cliente: {
    description: 'Busca conta analítica de um cliente',
    execute: buscarContaCliente
  },
  
  verificar_equacao_contabil: {
    description: 'Verifica se Débitos = Créditos',
    execute: verificarEquacao
  },
  
  verificar_saldo_transitoria: {
    description: 'Verifica saldo da conta 1.1.9.01',
    execute: verificarTransitoria
  },

  // ===== CRIAÇÃO (com validação automática) =====
  criar_lancamento: {
    description: 'Cria lançamento contábil (validado pelo guardião)',
    execute: async (params) => {
      // Valida ANTES de criar
      const validacao = await validarAntesDeExecutar(params);
      if (!validacao.valido) {
        return { 
          sucesso: false, 
          erros: validacao.erros,
          mensagem: 'Lançamento BLOQUEADO pelo guardião MCP'
        };
      }
      // Se passou, executa
      return await executarLancamento(params);
    }
  },

  criar_conta_cliente: {
    description: 'Cria conta analítica para cliente',
    execute: criarContaCliente
  },

  // ===== CONCILIAÇÃO =====
  desmembrar_cobranca: {
    description: 'Desmembra cobrança agrupada por cliente',
    execute: desmembrarCobranca
  },

  // ===== DIAGNÓSTICO =====
  diagnostico_completo: {
    description: 'Executa diagnóstico de integridade',
    execute: diagnosticoCompleto
  }
};
```

---

## 6. DR. CÍCERO COMO ORQUESTRADOR

### 6.1 System Prompt Atualizado

```markdown
# DR. CÍCERO - ORQUESTRADOR CONTÁBIL

Você é o Dr. Cícero, contador digital da AMPLA Contabilidade.

## SEU PAPEL

Você ORQUESTRA o sistema contábil, mas NÃO executa diretamente.
Todas as operações passam pelo MCP Financeiro (o guardião).

## COMO FUNCIONA

1. Usuário pede algo → Você interpreta
2. Você chama ferramenta do MCP → MCP valida
3. Se MCP aprovar → Executa
4. Se MCP bloquear → Você explica o motivo

## FERRAMENTAS DISPONÍVEIS

Você tem acesso às ferramentas do MCP:
- buscar_conta_cliente
- criar_lancamento
- criar_conta_cliente
- desmembrar_cobranca
- verificar_equacao_contabil
- diagnostico_completo

## FLUXO CORRETO (memorize!)

1. PROVISÃO: D-Cliente C-Receita
2. OFX COBRANÇA: D-Banco C-Transitória
3. OFX INDIVIDUAL: D-Banco C-Cliente
4. DESMEMBRAMENTO: D-Transitória C-Clientes (múltiplos)
5. DESPESA: D-DespesaEspecífica C-Banco

## REGRAS INVIOLÁVEIS

- NUNCA usar conta 1.1.2.01 (sintética)
- SEMPRE validar Débito = Crédito
- SEMPRE verificar idempotência
- Cobrança agrupada → Transitória primeiro
```

### 6.2 Exemplo de Interação

```
👤 Usuário: Importei o OFX de hoje, pode processar?

🤖 Dr. Cícero: Vou processar o OFX. Identificando transações...

   [Chama MCP: processar_ofx]
   
   📊 Resultado:
   
   ✅ 15 transações processadas:
   - 3 cobranças agrupadas → Conta transitória (R$ 12.500)
   - 8 recebimentos PIX identificados → Clientes baixados (R$ 4.200)
   - 2 recebimentos não identificados → Pendente (R$ 800)
   - 2 despesas classificadas → Energia + Internet (R$ 450)
   
   ⚠️ Ações pendentes:
   - 3 cobranças aguardam desmembramento
   - 2 recebimentos precisam identificar cliente
   
   Quer que eu desmembre as cobranças agora?

👤 Usuário: Sim, usa o arquivo de retorno do Sicredi

🤖 Dr. Cícero: Processando arquivo de retorno...

   [Chama MCP: desmembrar_cobranca]
   
   ✅ Desmembramento concluído:
   
   COB000027 (R$ 5.913,78) → 5 clientes
   COB000028 (R$ 4.200,00) → 3 clientes
   COB000029 (R$ 2.386,22) → 4 clientes
   
   Conta transitória: R$ 0,00 ✅
   Equação contábil: Balanceada ✅
```

---

## 7. IMPLEMENTAÇÃO TÉCNICA

### 7.1 Estrutura de Arquivos

```
📁 supabase/
├── 📁 functions/
│   ├── 📁 processar-ofx/
│   │   └── index.ts
│   ├── 📁 desmembrar-cobranca/
│   │   └── index.ts
│   ├── 📁 gerar-honorarios/
│   │   └── index.ts
│   ├── 📁 classificar-despesas/
│   │   └── index.ts
│   └── 📁 mcp-financeiro/
│       ├── index.ts
│       ├── 📁 tools/
│       │   ├── criar_lancamento.ts
│       │   ├── buscar_conta.ts
│       │   └── ...
│       └── 📁 middleware/
│           └── validador.ts
│
├── 📁 storage/
│   └── 📁 imports/
│       └── 📁 ofx/
│           └── {data}/{arquivo}.ofx
│
└── 📁 migrations/
    └── criar_plano_contas_despesas.sql

📁 src/
├── 📁 pages/
│   ├── BankImport.tsx (modificado)
│   └── SuperConciliation.tsx (modificado)
└── 📁 services/
    └── AccountingService.ts (com validação)
```

### 7.2 Triggers do Storage

```sql
-- Trigger para processar OFX automaticamente
CREATE OR REPLACE FUNCTION handle_ofx_upload()
RETURNS TRIGGER AS $$
BEGIN
  -- Chama Edge Function quando arquivo é inserido
  PERFORM
    net.http_post(
      url := 'https://xxxx.supabase.co/functions/v1/processar-ofx',
      body := json_build_object(
        'bucket', NEW.bucket_id,
        'name', NEW.name,
        'created_at', NEW.created_at
      )::text,
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ofx_uploaded
AFTER INSERT ON storage.objects
FOR EACH ROW
WHEN (NEW.bucket_id = 'imports' AND NEW.name LIKE '%.ofx')
EXECUTE FUNCTION handle_ofx_upload();
```

### 7.3 Cron Jobs

```sql
-- Gerar honorários todo dia 30
SELECT cron.schedule(
  'gerar-honorarios-mensal',
  '0 8 30 * *',  -- Dia 30, às 8h
  $$
  SELECT net.http_post(
    'https://xxxx.supabase.co/functions/v1/gerar-honorarios',
    '{"competencia": "' || to_char(CURRENT_DATE, 'YYYY-MM') || '"}'
  );
  $$
);
```

---

## 📋 RESUMO FINAL

| Componente | Responsabilidade | Tecnologia |
|------------|------------------|------------|
| **MCP Financeiro** | Validar TUDO, proteger contra erros | Edge Function + Tools |
| **Dr. Cícero** | Orquestrar, interpretar, explicar | Claude + System Prompt |
| **processar-ofx** | Importar e classificar transações | Edge Function |
| **desmembrar-cobranca** | Baixar clientes de cobrança agrupada | Edge Function |
| **gerar-honorarios** | Provisionar receitas mensais | Edge Function + Cron |
| **classificar-despesas** | Categorizar despesas automaticamente | Edge Function + IA |

---

*Arquitetura projetada para ZERO erros contábeis*
