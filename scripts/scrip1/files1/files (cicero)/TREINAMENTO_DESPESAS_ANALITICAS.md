# 🎯 TREINAMENTO: Contas Analíticas de Despesas

**Versão:** 1.0
**Data:** 11/01/2026
**Objetivo:** Treinar o Dr. Cícero para criar contas analíticas de despesas automaticamente, evitando acúmulo de despesas distintas na mesma conta.

---

## 🔴 PROBLEMA IDENTIFICADO

Despesas distintas estão sendo acumuladas em contas genéricas como:
- `4.1.2.99` - Outras Despesas Administrativas
- `4.1.1.99` - Despesa a Conciliar

**Exemplos de acúmulo incorreto:**
```
4.1.2.99 | Segurança do Prédio      | R$ 197,00
4.1.2.99 | Manutenção do Elevador   | R$ 200,00
4.1.2.99 | Plano de Saúde CASAG     | R$ 4.339,32
4.1.2.99 | Internet APT Sergio      | R$ 182,66  ← DEVERIA SER ADIANTAMENTO!
```

**Problema:** Impossível gerar razão contábil por tipo de despesa!

---

## ✅ SOLUÇÃO: CONTAS ANALÍTICAS POR TIPO DE DESPESA

### REGRA 1: Identificar Categoria Principal

Antes de criar conta, identificar a categoria:

| Palavra-chave | Categoria | Conta Pai |
|---------------|-----------|-----------|
| SEGURANÇA, VIGILÂNCIA | Segurança | 4.1.2.18 |
| ELEVADOR, MANUTENÇÃO PREDIAL | Manutenção Predial | 4.1.2.19 |
| PLANO SAÚDE, CASAG, UNIMED | Benefícios Funcionários | 4.1.1.11 |
| SOFTWARE, SISTEMA, LICENÇA | Software e Sistemas | 4.1.2.12 |
| INTERNET, TELEFONE | Telecomunicações | 4.1.2.03/05 |
| ENERGIA, LUZ, CEMIG, ENEL | Energia Elétrica | 4.1.2.02 |
| ÁGUA, SANEAGO | Água | 4.1.2.07 |
| GÁS, COMGÁS | Gás | 4.1.2.06 |
| ALUGUEL, LOCAÇÃO | Aluguel | 4.1.2.01 |
| CONDOMÍNIO | Condomínio | 4.1.2.10 |
| CONTADOR, CONTABILIDADE | Serviços Contábeis | 4.1.2.13.02 |
| ADVOGADO, JURÍDICO | Serviços Jurídicos | 4.1.2.20 |
| LIMPEZA, FAXINA | Limpeza | 4.1.2.13.06 |

### REGRA 2: Verificar se é PESSOAL ou EMPRESA

**⚠️ CRÍTICO:** Se a despesa for de uso PESSOAL dos sócios/família:

| Indicador | Ação | Conta |
|-----------|------|-------|
| APT SERGIO, CASA SERGIO | ADIANTAMENTO | 1.1.3.01 |
| LAGO, SÍTIO | ADIANTAMENTO | 1.1.3.99 |
| FACULDADE, MEDICINA | ADIANTAMENTO | 1.1.3.03 |
| BABÁ, NAYARA | ADIANTAMENTO | 1.1.3.05 |
| CARLA, VICTOR | ADIANTAMENTO | 1.1.3.xx |

**NUNCA criar conta de despesa para gastos pessoais!**

### REGRA 3: Criar Conta Analítica se não existir

```
ESTRUTURA RECOMENDADA:

4.1.2 Despesas Administrativas (SINTÉTICA)
├── 4.1.2.18 Segurança e Vigilância (SINTÉTICA)
│   ├── 4.1.2.18.01 Segurança Predial - Monitoramento
│   ├── 4.1.2.18.02 Segurança Predial - Vigilância
│   └── 4.1.2.18.03 Alarme e CFTV
│
├── 4.1.2.19 Manutenção Predial (SINTÉTICA)
│   ├── 4.1.2.19.01 Elevador - Manutenção
│   ├── 4.1.2.19.02 Ar Condicionado - Manutenção
│   ├── 4.1.2.19.03 Elétrica - Manutenção
│   ├── 4.1.2.19.04 Hidráulica - Manutenção
│   └── 4.1.2.19.05 Pintura e Reparos Gerais
│
├── 4.1.2.20 Serviços Profissionais (SINTÉTICA)
│   ├── 4.1.2.20.01 Serviços Jurídicos
│   ├── 4.1.2.20.02 Consultoria Empresarial
│   ├── 4.1.2.20.03 Marketing e Publicidade
│   └── 4.1.2.20.04 Outros Serviços Profissionais
```

---

## 🔧 IMPLEMENTAÇÃO NO DR. CÍCERO

### Função: `ensureExpenseAccount`

```typescript
async function ensureExpenseAccount(
  supabase: any,
  descricao: string,
  valor: number
): Promise<{ account_id: string; account_code: string; is_personal: boolean }> {

  // 1. VERIFICAR SE É DESPESA PESSOAL
  const personalPatterns = [
    { pattern: /APT\s*SERGIO|CASA\s*SERGIO|APARTAMENTO\s*SERGIO/i, account: '1.1.3.01', name: 'Sérgio Carneiro' },
    { pattern: /LAGO|SITIO|SÍTIO/i, account: '1.1.3.99', name: 'Sítio Família' },
    { pattern: /FACULDADE|MEDICINA|SERGIO\s*AUGUSTO/i, account: '1.1.3.03', name: 'Sérgio Augusto' },
    { pattern: /BABA|BABÁ|NAYARA/i, account: '1.1.3.05', name: 'Nayara' },
    { pattern: /CARLA/i, account: '1.1.3.02', name: 'Carla Leão' },
    { pattern: /VICTOR/i, account: '1.1.3.04', name: 'Victor Hugo' },
  ];

  for (const p of personalPatterns) {
    if (p.pattern.test(descricao)) {
      const { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id, code')
        .eq('code', p.account)
        .single();

      return {
        account_id: conta?.id,
        account_code: p.account,
        is_personal: true
      };
    }
  }

  // 2. IDENTIFICAR CATEGORIA DE DESPESA
  const expenseCategories = [
    { pattern: /SEGURANÇA|VIGILANCIA|VIGILÂNCIA|MONITORAMENTO/i, parent: '4.1.2.18', name: 'Segurança' },
    { pattern: /ELEVADOR/i, parent: '4.1.2.19', subcode: '01', name: 'Elevador - Manutenção' },
    { pattern: /AR\s*CONDICIONADO|SPLIT|HVAC/i, parent: '4.1.2.19', subcode: '02', name: 'Ar Condicionado' },
    { pattern: /ELETRIC|ELÉTRIC/i, parent: '4.1.2.19', subcode: '03', name: 'Elétrica' },
    { pattern: /HIDRAULIC|HIDRÁULIC|ENCANAMENTO/i, parent: '4.1.2.19', subcode: '04', name: 'Hidráulica' },
    { pattern: /PINTURA|REFORMA/i, parent: '4.1.2.19', subcode: '05', name: 'Pintura e Reformas' },
    { pattern: /PLANO\s*SAUDE|PLANO\s*SAÚDE|CASAG|UNIMED/i, parent: '4.1.1.11', name: 'Plano de Saúde' },
    { pattern: /SOFTWARE|SISTEMA|LICENÇA|ASSINATURA/i, parent: '4.1.2.12', name: 'Software' },
    { pattern: /ADVOGAD|JURIDIC|JURÍDIC/i, parent: '4.1.2.20', subcode: '01', name: 'Serviços Jurídicos' },
    { pattern: /CONSULTORIA/i, parent: '4.1.2.20', subcode: '02', name: 'Consultoria' },
    { pattern: /MARKETING|PUBLICIDADE/i, parent: '4.1.2.20', subcode: '03', name: 'Marketing' },
  ];

  for (const cat of expenseCategories) {
    if (cat.pattern.test(descricao)) {
      // Verificar se conta já existe
      const targetCode = cat.subcode ? `${cat.parent}.${cat.subcode}` : cat.parent;

      let { data: conta } = await supabase
        .from('chart_of_accounts')
        .select('id, code')
        .eq('code', targetCode)
        .single();

      if (!conta) {
        // Criar conta analítica
        conta = await createExpenseAccount(supabase, cat.parent, cat.subcode, cat.name);
      }

      return {
        account_id: conta.id,
        account_code: conta.code,
        is_personal: false
      };
    }
  }

  // 3. FALLBACK: Usar conta genérica mas ALERTAR
  console.warn(`[Dr.Cícero] ⚠️ Despesa não categorizada: ${descricao}`);
  console.warn(`[Dr.Cícero] Considere criar conta específica para: ${descricao}`);

  const { data: contaGenerica } = await supabase
    .from('chart_of_accounts')
    .select('id, code')
    .eq('code', '4.1.2.99')
    .single();

  return {
    account_id: contaGenerica?.id,
    account_code: '4.1.2.99',
    is_personal: false
  };
}
```

### Função: `createExpenseAccount`

```typescript
async function createExpenseAccount(
  supabase: any,
  parentCode: string,
  subcode: string | null,
  name: string
): Promise<{ id: string; code: string }> {

  // Buscar conta pai
  const { data: parentAccount } = await supabase
    .from('chart_of_accounts')
    .select('id')
    .eq('code', parentCode)
    .single();

  if (!parentAccount) {
    // Criar conta pai se não existir
    // ... (implementar criação hierárquica)
  }

  // Determinar próximo código
  let newCode: string;
  if (subcode) {
    newCode = `${parentCode}.${subcode}`;
  } else {
    const { data: lastChild } = await supabase
      .from('chart_of_accounts')
      .select('code')
      .like('code', `${parentCode}.%`)
      .order('code', { ascending: false })
      .limit(1);

    const lastNum = lastChild?.[0]?.code
      ? parseInt(lastChild[0].code.split('.').pop() || '0')
      : 0;
    newCode = `${parentCode}.${String(lastNum + 1).padStart(2, '0')}`;
  }

  // Criar conta
  const { data: newAccount, error } = await supabase
    .from('chart_of_accounts')
    .insert({
      code: newCode,
      name: `Despesa: ${name}`,
      account_type: 'DESPESA',
      nature: 'DEVEDORA',
      parent_id: parentAccount.id,
      level: newCode.split('.').length,
      is_analytical: true,
      is_synthetic: false,
      is_active: true,
      accepts_entries: true
    })
    .select('id, code')
    .single();

  if (error) {
    console.error('[Dr.Cícero] Erro ao criar conta:', error);
    throw error;
  }

  console.log(`[Dr.Cícero] ✅ Conta criada: ${newCode} - Despesa: ${name}`);
  return newAccount;
}
```

---

## 📋 FLUXO DE CLASSIFICAÇÃO

```
┌─────────────────────────────────────────────────────────────┐
│ 1. RECEBER DESCRIÇÃO DA DESPESA                             │
│    Ex: "ADVANCE - MANUTENÇÃO DO ELEVADOR"                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. VERIFICAR SE É PESSOAL                                   │
│    Padrões: APT SERGIO, LAGO, SÍTIO, FACULDADE, etc.       │
│    Se SIM → Usar conta de ADIANTAMENTO (1.1.3.xx)          │
└─────────────────────────────────────────────────────────────┘
                              │ NÃO
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. IDENTIFICAR CATEGORIA                                    │
│    ELEVADOR → 4.1.2.19.01 (Manutenção Predial - Elevador)  │
│    Se não existe → CRIAR CONTA                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. CRIAR LANÇAMENTO                                         │
│    D - 4.1.2.19.01 (Manutenção Predial - Elevador)         │
│    C - 1.1.1.05 (Banco Sicredi)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚫 NUNCA FAZER

1. ❌ Lançar despesa pessoal como despesa da empresa
2. ❌ Acumular despesas diferentes na conta 4.1.2.99
3. ❌ Criar conta analítica dentro de outra analítica
4. ❌ Lançar em conta sintética

## ✅ SEMPRE FAZER

1. ✅ Verificar primeiro se é despesa pessoal → ADIANTAMENTO
2. ✅ Identificar categoria específica da despesa
3. ✅ Criar conta analítica se não existir
4. ✅ Manter razão contábil por tipo de despesa
5. ✅ Usar descrição clara e padronizada

---

## 📊 CONSULTAS DE VALIDAÇÃO

```sql
-- Verificar acúmulo na conta genérica
SELECT
  ael.description,
  ael.debit,
  ae.entry_date
FROM accounting_entry_lines ael
JOIN accounting_entries ae ON ael.entry_id = ae.id
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '4.1.2.99'
ORDER BY ae.entry_date DESC;

-- Listar contas de despesa com lançamentos
SELECT
  coa.code,
  coa.name,
  COUNT(ael.id) as lancamentos,
  SUM(ael.debit) as total_debitos
FROM chart_of_accounts coa
LEFT JOIN accounting_entry_lines ael ON coa.id = ael.account_id
WHERE coa.code LIKE '4.%'
  AND coa.is_analytical = true
GROUP BY coa.code, coa.name
HAVING COUNT(ael.id) > 0
ORDER BY total_debitos DESC;
```

---

**Dr. Cícero diz:** *"Cada despesa no seu lugar, razão contábil sempre claro!"* 🎯
