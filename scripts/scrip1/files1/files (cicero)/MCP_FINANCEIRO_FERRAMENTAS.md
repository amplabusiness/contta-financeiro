# 🛠️ MCP FINANCEIRO - Especificação de Ferramentas v2.0

Este documento define as ferramentas que o MCP Financeiro deve expor, seguindo a arquitetura contábil correta.

---

## 📋 ÍNDICE

1. [Ferramentas de Consulta](#1-ferramentas-de-consulta)
2. [Ferramentas de Criação](#2-ferramentas-de-criação)
3. [Ferramentas de Conciliação](#3-ferramentas-de-conciliação)
4. [Ferramentas de Validação](#4-ferramentas-de-validação)

---

## 1. FERRAMENTAS DE CONSULTA

### 1.1 `buscar_conta_cliente`

**Descrição:** Busca a conta analítica de um cliente no plano de contas.

**Parâmetros:**
```typescript
{
  nome_cliente?: string;    // Nome ou parte do nome
  client_id?: string;       // ID do cliente
  cnpj?: string;            // CNPJ do cliente
}
```

**Retorno:**
```typescript
{
  encontrada: boolean;
  conta?: {
    id: string;
    code: string;          // Ex: "1.1.2.01.0015"
    name: string;          // Ex: "Cliente: ACME LTDA"
    saldo: number;         // Saldo atual (D-C)
  };
  sugestao?: string;       // Se não encontrada, sugere criar
}
```

**Implementação:**
```typescript
async function buscar_conta_cliente(params: BuscarContaParams) {
  let query = supabase
    .from('chart_of_accounts')
    .select('id, code, name')
    .ilike('code', '1.1.2.01.%');  // Apenas analíticas de clientes

  if (params.nome_cliente) {
    query = query.ilike('name', `%${params.nome_cliente}%`);
  }

  if (params.client_id) {
    // Buscar nome do cliente primeiro
    const { data: cliente } = await supabase
      .from('clients')
      .select('name')
      .eq('id', params.client_id)
      .single();
    
    if (cliente) {
      query = query.ilike('name', `%${cliente.name}%`);
    }
  }

  const { data: contas } = await query;

  if (!contas || contas.length === 0) {
    return {
      encontrada: false,
      sugestao: `Conta analítica não encontrada. Use 'criar_conta_cliente' para criar.`
    };
  }

  // Calcular saldo
  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', contas[0].id);

  const saldo = (linhas || []).reduce(
    (acc, l) => acc + (l.debit || 0) - (l.credit || 0), 
    0
  );

  return {
    encontrada: true,
    conta: { ...contas[0], saldo }
  };
}
```

---

### 1.2 `listar_clientes_a_receber`

**Descrição:** Lista todos os clientes com saldo a receber, ordenados por valor.

**Parâmetros:**
```typescript
{
  limite?: number;          // Máximo de resultados (default: 50)
  apenas_positivos?: boolean; // Apenas saldos > 0 (default: true)
  ordenar_por?: 'saldo' | 'nome' | 'codigo';
}
```

**Retorno:**
```typescript
{
  clientes: Array<{
    code: string;
    name: string;
    saldo: number;
    ultima_movimentacao?: string;  // Data ISO
  }>;
  total_a_receber: number;
  quantidade: number;
}
```

---

### 1.3 `verificar_saldo_transitoria`

**Descrição:** Verifica o saldo da conta transitória 1.1.9.01 (Recebimentos a Conciliar).

**Parâmetros:** Nenhum

**Retorno:**
```typescript
{
  saldo: number;
  movimentacoes_pendentes: number;
  status: 'zerada' | 'pendente_conciliacao' | 'problema';
  mensagem: string;
}
```

**Implementação:**
```typescript
async function verificar_saldo_transitoria() {
  const { data: conta } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .single();

  if (!conta) {
    return {
      saldo: 0,
      movimentacoes_pendentes: 0,
      status: 'problema',
      mensagem: 'Conta 1.1.9.01 não existe! Execute o script de criação.'
    };
  }

  const { data: linhas } = await supabase
    .from('accounting_entry_lines')
    .select('debit, credit')
    .eq('account_id', conta.id);

  const saldo = (linhas || []).reduce(
    (acc, l) => acc + (l.debit || 0) - (l.credit || 0),
    0
  );

  if (Math.abs(saldo) < 0.01) {
    return {
      saldo: 0,
      movimentacoes_pendentes: 0,
      status: 'zerada',
      mensagem: 'Conta transitória zerada. Todas as conciliações foram feitas.'
    };
  }

  return {
    saldo,
    movimentacoes_pendentes: linhas?.length || 0,
    status: 'pendente_conciliacao',
    mensagem: `Há R$ ${saldo.toFixed(2)} pendentes de conciliação com clientes.`
  };
}
```

---

### 1.4 `verificar_equacao_contabil`

**Descrição:** Verifica se a equação contábil está balanceada (Débitos = Créditos).

**Parâmetros:** Nenhum

**Retorno:**
```typescript
{
  total_debitos: number;
  total_creditos: number;
  diferenca: number;
  balanceada: boolean;
  problemas?: string[];
}
```

---

## 2. FERRAMENTAS DE CRIAÇÃO

### 2.1 `criar_conta_cliente`

**Descrição:** Cria uma conta analítica para um cliente.

**Parâmetros:**
```typescript
{
  client_id: string;        // ID do cliente na tabela clients
  // OU
  nome_cliente: string;     // Nome para a conta
}
```

**Retorno:**
```typescript
{
  sucesso: boolean;
  conta?: {
    id: string;
    code: string;
    name: string;
  };
  erro?: string;
}
```

**Implementação:**
```typescript
async function criar_conta_cliente(params: CriarContaParams) {
  // 1. Buscar próximo código disponível
  const { data: ultimaConta } = await supabase
    .from('chart_of_accounts')
    .select('code')
    .ilike('code', '1.1.2.01.%')
    .order('code', { ascending: false })
    .limit(1);

  const ultimoNumero = ultimaConta?.[0]?.code 
    ? parseInt(ultimaConta[0].code.split('.').pop() || '0')
    : 0;
  
  const novoCodigo = `1.1.2.01.${String(ultimoNumero + 1).padStart(4, '0')}`;

  // 2. Buscar nome do cliente se fornecido client_id
  let nomeCliente = params.nome_cliente;
  if (params.client_id) {
    const { data: cliente } = await supabase
      .from('clients')
      .select('name')
      .eq('id', params.client_id)
      .single();
    nomeCliente = cliente?.name || params.nome_cliente;
  }

  if (!nomeCliente) {
    return { sucesso: false, erro: 'Nome do cliente é obrigatório' };
  }

  // 3. Buscar parent_id da conta sintética
  const { data: contaPai } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.2.01')
    .single();

  // 4. Criar conta
  const { data: novaConta, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code: novoCodigo,
      name: `Cliente: ${nomeCliente}`,
      account_type: 'ATIVO',
      nature: 'DEVEDORA',
      parent_id: contaPai?.id,
      level: 5,
      is_analytical: true,
      is_synthetic: false,
      is_active: true,
      accepts_entries: true,
      description: `Conta a receber do cliente ${nomeCliente}`
    })
    .select('id, code, name')
    .single();

  if (error) {
    return { sucesso: false, erro: error.message };
  }

  return { sucesso: true, conta: novaConta };
}
```

---

### 2.2 `criar_lancamento_honorarios`

**Descrição:** Cria lançamento de receita de honorários (competência).

**Parâmetros:**
```typescript
{
  client_id: string;
  invoice_id: string;
  valor: number;
  data_competencia: string;   // YYYY-MM-DD
  descricao?: string;
}
```

**Validações obrigatórias:**
1. Verificar se cliente tem conta analítica
2. Verificar se invoice_id já tem lançamento
3. Verificar se valor > 0

**Lançamento gerado:**
```
D - 1.1.2.01.xxxx (Cliente)     [valor]
C - 3.1.1.01 (Receita)          [valor]
```

---

### 2.3 `criar_lancamento_recebimento`

**Descrição:** Cria lançamento de recebimento de cliente.

**Parâmetros:**
```typescript
{
  client_id: string;
  bank_transaction_id: string;  // fitid do OFX
  valor: number;
  data: string;                 // YYYY-MM-DD
  descricao?: string;
}
```

**Validações obrigatórias:**
1. Verificar se cliente tem conta analítica
2. Verificar se bank_transaction_id já tem lançamento
3. Verificar se valor > 0

**Lançamento gerado:**
```
D - 1.1.1.05 (Banco)            [valor]
C - 1.1.2.01.xxxx (Cliente)     [valor]
```

---

### 2.4 `criar_lancamento_cobranca_transitoria`

**Descrição:** Cria lançamento de cobrança agrupada na conta transitória.

**Parâmetros:**
```typescript
{
  bank_transaction_id: string;  // fitid do OFX
  codigo_cobranca: string;      // COB000027
  valor: number;
  data: string;                 // YYYY-MM-DD
}
```

**⚠️ IMPORTANTE:** Este lançamento NÃO baixa clientes! Apenas registra na transitória.

**Lançamento gerado:**
```
D - 1.1.1.05 (Banco)            [valor]
C - 1.1.9.01 (Transitória)      [valor]
```

---

## 3. FERRAMENTAS DE CONCILIAÇÃO

### 3.1 `desmembrar_cobranca`

**Descrição:** Desmembra uma cobrança agrupada em baixas individuais por cliente.

**Parâmetros:**
```typescript
{
  codigo_cobranca: string;      // COB000027
  data: string;                 // YYYY-MM-DD
  clientes: Array<{
    client_id: string;
    valor: number;
  }>;
}
```

**Validações obrigatórias:**
1. Soma dos valores dos clientes = valor original da cobrança
2. Todos os clientes têm conta analítica
3. Cobrança ainda não foi desmembrada

**Lançamento gerado:**
```
D - 1.1.9.01 (Transitória)      [total]
C - 1.1.2.01.0001 (Cliente 1)   [valor1]
C - 1.1.2.01.0002 (Cliente 2)   [valor2]
... (N clientes)
```

**Implementação:**
```typescript
async function desmembrar_cobranca(params: DesmembrarParams) {
  // 1. Validar soma
  const totalClientes = params.clientes.reduce((s, c) => s + c.valor, 0);
  
  // Buscar valor original da cobrança
  const { data: cobrancaOriginal } = await supabase
    .from('accounting_entries')
    .select('id')
    .eq('reference_type', 'bank_transaction')
    .eq('description', `%${params.codigo_cobranca}%`)
    .single();

  // ... validações

  // 2. Verificar contas analíticas de todos os clientes
  const contasClientes = [];
  for (const cliente of params.clientes) {
    const conta = await buscar_conta_cliente({ client_id: cliente.client_id });
    if (!conta.encontrada) {
      // Criar conta automaticamente
      const novaConta = await criar_conta_cliente({ client_id: cliente.client_id });
      contasClientes.push({ ...cliente, conta_id: novaConta.conta?.id });
    } else {
      contasClientes.push({ ...cliente, conta_id: conta.conta?.id });
    }
  }

  // 3. Buscar conta transitória
  const { data: contaTransitoria } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', '1.1.9.01')
    .single();

  // 4. Criar entry
  const { data: entry } = await supabase
    .from('accounting_entries')
    .insert({
      entry_date: params.data,
      entry_type: 'recebimento',
      description: `Desmembramento ${params.codigo_cobranca} - ${params.clientes.length} clientes`,
      reference_type: 'cobranca_desmembramento',
      reference_id: params.codigo_cobranca,
      source_type: 'super_conciliacao'
    })
    .select('id')
    .single();

  // 5. Criar linhas
  const linhas = [
    // Débito na transitória (estorno)
    {
      entry_id: entry.id,
      account_id: contaTransitoria.id,
      debit: totalClientes,
      credit: 0,
      description: `Estorno transitória - ${params.codigo_cobranca}`
    },
    // Créditos nos clientes
    ...contasClientes.map(c => ({
      entry_id: entry.id,
      account_id: c.conta_id,
      debit: 0,
      credit: c.valor,
      description: `Baixa ${params.codigo_cobranca}`
    }))
  ];

  await supabase.from('accounting_entry_lines').insert(linhas);

  return {
    sucesso: true,
    entry_id: entry.id,
    clientes_baixados: params.clientes.length,
    valor_total: totalClientes
  };
}
```

---

### 3.2 `identificar_cliente_transacao`

**Descrição:** Tenta identificar o cliente de uma transação bancária pelo nome/descrição.

**Parâmetros:**
```typescript
{
  descricao: string;          // Descrição do OFX
  valor?: number;             // Para ajudar na identificação
}
```

**Retorno:**
```typescript
{
  identificado: boolean;
  confianca: 'alta' | 'media' | 'baixa';
  cliente?: {
    id: string;
    name: string;
    conta_code: string;
  };
  alternativas?: Array<{...}>;
}
```

---

## 4. FERRAMENTAS DE VALIDAÇÃO

### 4.1 `validar_lancamento_antes_criar`

**Descrição:** Valida um lançamento ANTES de criar, retornando erros se houver.

**Parâmetros:**
```typescript
{
  linhas: Array<{
    account_code: string;
    debit: number;
    credit: number;
  }>;
  reference_type: string;
  reference_id: string;
}
```

**Retorno:**
```typescript
{
  valido: boolean;
  erros: string[];
  avisos: string[];
}
```

**Validações:**
```typescript
async function validar_lancamento_antes_criar(params: ValidarParams) {
  const erros = [];
  const avisos = [];

  // 1. Verificar partidas dobradas
  const totalDebitos = params.linhas.reduce((s, l) => s + l.debit, 0);
  const totalCreditos = params.linhas.reduce((s, l) => s + l.credit, 0);
  
  if (Math.abs(totalDebitos - totalCreditos) > 0.01) {
    erros.push(`Lançamento desbalanceado: D=${totalDebitos} C=${totalCreditos}`);
  }

  // 2. Verificar contas sintéticas
  for (const linha of params.linhas) {
    const { data: conta } = await supabase
      .from('chart_of_accounts')
      .select('is_synthetic, accepts_entries, code')
      .eq('code', linha.account_code)
      .single();

    if (!conta) {
      erros.push(`Conta ${linha.account_code} não existe`);
    } else if (conta.is_synthetic) {
      erros.push(`Conta ${linha.account_code} é sintética - não aceita lançamentos`);
    } else if (!conta.accepts_entries) {
      erros.push(`Conta ${linha.account_code} não aceita lançamentos`);
    }
  }

  // 3. Verificar idempotência
  const { count } = await supabase
    .from('accounting_entries')
    .select('id', { count: 'exact' })
    .eq('reference_type', params.reference_type)
    .eq('reference_id', params.reference_id);

  if (count > 0) {
    erros.push(`Já existe lançamento com reference_type='${params.reference_type}' e reference_id='${params.reference_id}'`);
  }

  // 4. Avisos
  if (params.linhas.length < 2) {
    avisos.push('Lançamento com menos de 2 linhas - verifique');
  }

  return {
    valido: erros.length === 0,
    erros,
    avisos
  };
}
```

---

### 4.2 `diagnostico_completo`

**Descrição:** Executa diagnóstico completo do sistema contábil.

**Parâmetros:** Nenhum

**Retorno:**
```typescript
{
  equacao_contabil: {
    balanceada: boolean;
    diferenca: number;
  };
  conta_sintetica: {
    lancamentos_diretos: number;  // Deve ser 0
  };
  conta_transitoria: {
    saldo: number;
    status: string;
  };
  linhas_orfas: number;           // Deve ser 0
  entries_desbalanceados: number; // Deve ser 0
  recomendacoes: string[];
}
```

---

## 📎 ANEXO: Mapeamento de Erros

| Código | Mensagem | Ação |
|--------|----------|------|
| E001 | Conta sintética | Usar conta analítica |
| E002 | Lançamento duplicado | Retornar existente |
| E003 | Débito ≠ Crédito | Corrigir valores |
| E004 | Conta não existe | Criar conta primeiro |
| E005 | reference_id vazio | Preencher obrigatório |

---

*MCP Financeiro v2.0 - Compatível com Agente Cícero*
