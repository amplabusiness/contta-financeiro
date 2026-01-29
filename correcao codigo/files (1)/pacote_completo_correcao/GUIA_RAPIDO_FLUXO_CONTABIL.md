# 🎯 GUIA RÁPIDO: FLUXO CONTÁBIL CORRETO - AMPLA

**LEIA ISTO ANTES DE CRIAR QUALQUER LANÇAMENTO!**

---

## ⚠️ REGRAS DE OURO (NUNCA VIOLAR)

```
1. NUNCA lançar na conta 1.1.2.01 (é SINTÉTICA!)
   → Use sempre 1.1.2.01.xxxx (analítica do cliente)

2. NUNCA criar lançamento com Débito ≠ Crédito
   → Partidas dobradas são OBRIGATÓRIAS

3. NUNCA duplicar lançamento
   → Verificar reference_id ANTES de criar

4. NUNCA debitar o banco 2x para mesmo recebimento
   → Cobrança agrupada → conta transitória primeiro
```

---

## 📊 FLUXO CORRETO EM 3 PASSOS

### PASSO 1: GERAR HONORÁRIOS (Todo dia 30)
```
Quando: Gerar faturas mensais

Lançamento:
  D - 1.1.2.01.xxxx (Cliente específico)    R$ 1.500,00
  C - 3.1.1.01 (Receita Honorários)         R$ 1.500,00

✅ Isso PROVISIONA a receita (regime competência)
✅ Cliente fica com saldo DEVEDOR (ele nos deve)
```

### PASSO 2: IMPORTAR OFX (Quando receber extrato)
```
Quando: Importar arquivo OFX do banco

Se for COBRANÇA AGRUPADA (COB000xxx):
  D - 1.1.1.05 (Banco Sicredi)              R$ 5.913,78
  C - 1.1.9.01 (Recebimentos a Conciliar)   R$ 5.913,78
                 ↑ CONTA TRANSITÓRIA!

Se for RECEBIMENTO IDENTIFICÁVEL (PIX de cliente conhecido):
  D - 1.1.1.05 (Banco Sicredi)              R$ 1.500,00
  C - 1.1.2.01.xxxx (Cliente específico)    R$ 1.500,00

✅ Banco = OFX (sempre!)
✅ Cobrança agrupada NÃO baixa clientes ainda
```

### PASSO 3: CONCILIAR (Na Super Conciliação)
```
Quando: Desmembrar cobrança com CSV de clientes

Lançamento de desmembramento:
  D - 1.1.9.01 (Transitória - ESTORNO)      R$ 5.913,78
  C - 1.1.2.01.0001 (Cliente A)             R$   760,00
  C - 1.1.2.01.0002 (Cliente B)             R$   300,00
  C - 1.1.2.01.0003 (Cliente C)             R$ 4.853,78

✅ Transitória fica ZERADA
✅ Cada cliente é baixado individualmente
✅ Banco NÃO é tocado (já foi no passo 2)
```

---

## 🚫 O QUE CAUSOU O PROBLEMA ANTERIOR

```
ERRADO (o que acontecia antes):
─────────────────────────────────────────────────────
1. Importa OFX → Debita banco R$ 5.913,78
2. Script externo → Debita banco R$ 760,00 (Cliente A)
3. Script externo → Debita banco R$ 300,00 (Cliente B)
   ...
RESULTADO: Banco inflado! Mesmo dinheiro entrou 2x

CORRETO (como deve ser agora):
─────────────────────────────────────────────────────
1. Importa OFX → Debita banco, Credita TRANSITÓRIA
2. Concilia → Debita TRANSITÓRIA, Credita CLIENTES
RESULTADO: Banco = OFX sempre!
```

---

## 📋 CHECKLIST ANTES DE CRIAR LANÇAMENTO

```
□ A conta é ANALÍTICA? (código tem 5 níveis: 1.1.2.01.xxxx)
□ Débito = Crédito? (somar todas as linhas)
□ Já existe lançamento com esse reference_id?
□ reference_type e reference_id estão preenchidos?
□ É cobrança agrupada? → Usar conta transitória 1.1.9.01
```

---

## 🏦 CONTAS IMPORTANTES

| Código | Nome | Uso |
|--------|------|-----|
| `1.1.1.05` | Banco Sicredi | Movimentações bancárias |
| `1.1.2.01` | Clientes a Receber | **SINTÉTICA - NÃO USAR!** |
| `1.1.2.01.xxxx` | Cliente: [Nome] | Conta de cada cliente |
| `1.1.2.01.9999` | Pendente Identificação | Recebimentos não identificados |
| `1.1.9.01` | Recebimentos a Conciliar | **TRANSITÓRIA para OFX** |
| `3.1.1.01` | Receita Honorários | Receita de serviços |

---

## ⚡ AÇÕES RÁPIDAS

### Criar conta para novo cliente:
```sql
-- Próximo código disponível
SELECT MAX(code) FROM chart_of_accounts WHERE code LIKE '1.1.2.01.%';

-- Criar conta (substituir XXXX e NOME)
INSERT INTO chart_of_accounts (
  code, name, account_type, nature, parent_id, level,
  is_analytical, is_synthetic, is_active, accepts_entries
) VALUES (
  '1.1.2.01.XXXX', 'Cliente: NOME DO CLIENTE',
  'ATIVO', 'DEVEDORA',
  (SELECT id FROM chart_of_accounts WHERE code = '1.1.2.01'),
  5, true, false, true, true
);
```

### Verificar saldo da transitória:
```sql
SELECT SUM(debit) - SUM(credit) as saldo
FROM accounting_entry_lines ael
JOIN chart_of_accounts coa ON ael.account_id = coa.id
WHERE coa.code = '1.1.9.01';
-- DEVE SER 0 após conciliação completa!
```

### Verificar equação contábil:
```sql
SELECT 
  SUM(debit) as debitos,
  SUM(credit) as creditos,
  SUM(debit) - SUM(credit) as diferenca
FROM accounting_entry_lines;
-- diferenca DEVE SER 0!
```

---

## 🔴 SE ALGO DER ERRADO

1. **Equação não fecha?**
   → Rodar `node scripts/08_diagnostico_profundo.mjs`

2. **Lançamento duplicado?**
   → Deletar o entry E suas linhas (nunca só as linhas)

3. **Cliente sem conta analítica?**
   → Criar conta antes de lançar

4. **Transitória com saldo?**
   → Há cobranças pendentes de conciliação

---

## 📞 SUPORTE

Em caso de dúvida, consulte:
- `TREINAMENTO_MCP_CICERO.md` - Documentação completa
- `SYSTEM_PROMPT_CICERO.md` - Regras do agente
- `MCP_FINANCEIRO_FERRAMENTAS.md` - Ferramentas disponíveis

---

*"Partidas dobradas sempre, duplicações nunca!"* - Dr. Cícero
