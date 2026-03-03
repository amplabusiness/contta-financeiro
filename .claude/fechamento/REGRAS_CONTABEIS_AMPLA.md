# Regras Contábeis da Ampla Contabilidade
**Versão:** 1.0 | **Criado em:** 2026-03-02 | **Sessão:** 35

> ⚠️ **LEIA ESTE DOCUMENTO ANTES DE LANÇAR QUALQUER TRANSAÇÃO**
>
> Este documento contém as regras de negócio confirmadas pelo usuário (Sérgio Carneiro Leão,
> fundador da Ampla Contabilidade). Qualquer IA que trabalhar neste sistema DEVE respeitar
> estas regras, pois elas evitam erros contábeis que distorcem o DRE e o Balanço.

---

## 1. Regime de Competência — A Regra Fundamental

> "Primeiro eu trabalho, depois eu recebo — sempre assim, por mês de competência."
> — Sérgio Carneiro Leão

A Ampla trabalha **100% em regime de competência**:

| Mês | O que acontece |
|-----|----------------|
| Mês X | Serviço prestado → **Provisionar receita** (D: Clientes a Receber \| C: Honorários Contábeis) |
| Mês X+1 | Cliente paga → **Baixar recebível** (D: Banco \| C: Clientes a Receber) |

**Exemplo prático:**
- Janeiro/2025: Ampla presta serviço para cliente ABC → Provisiona R$ 1.000 em Jan/2025
- Fevereiro/2025: Cliente ABC paga → Dá baixa em Fev/2025 (D: Banco | C: Clientes a Receber)
- O DRE de Janeiro mostra R$ 1.000 de receita, mesmo sem ter recebido o dinheiro ainda

---

## 2. Janeiro/2025 — Período Especial de Abertura

### Regra absoluta (confirmada pelo usuário):

> **TODOS os recebimentos de caixa em Janeiro/2025 são pagamentos de 2024 (período anterior).**

Isso acontece porque:
- O sistema foi implantado em Janeiro/2025
- Os clientes pagaram em Janeiro/2025 os serviços de Dezembro/2024 (ou meses anteriores)
- Janeiro/2025 é o "primeiro mês" — o dinheiro que entra é de dívidas passadas

### Como lançar recebimentos de Janeiro/2025:

```
✅ CORRETO:
D: Banco Sicredi (1.1.1.05)
C: Clientes a Receber (1.1.2.01.XXXX)

❌ ERRADO:
D: Banco Sicredi
C: Honorários Contábeis (3.1.1.01)  ← NÃO GERA RECEITA DE 2025!
```

**Por quê?** Porque a receita já foi reconhecida em 2024 (período anterior).
O recebimento em Janeiro apenas "baixa" o saldo devedor do cliente.

### Lançamento contábil do Saldo de Abertura (setup inicial):
```
D: Clientes a Receber (1.1.2.01.XXXX)  ← ATIVO aumenta
C: Saldos de Abertura (5.2.1.02)       ← PL (não é Receita!)
```
Este lançamento representa "o cliente me devia isso antes do sistema existir".

---

## 3. Clientes com Honorário Variável (2,87% do Faturamento)

### Clientes com taxa variável confirmados:

| Cliente | Fixo/mês | Variável | Obs |
|---------|----------|----------|-----|
| ACTION SOLUÇÕES INDUSTRIAIS LTDA | R$ 12.143,72 | 2,87% do faturamento | Pagamentos > R$10k-12k em Jan/2025 |
| MATA PRAGAS | R$ 3.556,72 | 2,87% do faturamento | |
| R&P AVIAÇÃO | R$ 3.036,00 | 2,50% do faturamento | |
| L.F. GONÇALVES CONFECÇÕES | R$ 2.276,86 | 2,87% do faturamento | |
| IPE COMERCIO E SERVIÇO DE GESSO | R$ 0,00 | 2,87% do faturamento | |

### Regra para clientes com taxa variável:

1. **Todo mês pagam DOIS valores:** o fixo mensal + a % variável
2. **Se pagaram em Janeiro/2025:** ambos os valores (fixo e variável) são de 2024
3. **Lançamento correto em Janeiro/2025:** D: Banco | C: Clientes a Receber (igual a todos os outros)
4. **Para registrar o saldo de abertura variável:**
   D: Clientes a Receber | C: Saldos de Abertura (5.2.1.02) — NÃO creditar Honorários!

### Exemplo ACTION — o erro que foi corrigido em 2026-03-02:

| Data | Valor | Conta errada | Conta correta |
|------|-------|-------------|---------------|
| Jan/07/2025 | R$ 70.046,90 | C: 3.1.1.01 Honorários | C: 5.2.1.02 Saldos de Abertura |
| Jan/21/2025 | R$ 74.761,78 | C: 3.1.1.01 Honorários | C: 5.2.1.02 Saldos de Abertura |

Resultado: DRE estava com R$ 144.808,68 de receita falsa. Após correção: R$ 211.193,80 (correto).

---

## 4. Estrutura do Plano de Contas (resumo)

| Código | Nome | Tipo | Aumenta com |
|--------|------|------|-------------|
| 1.1.1.05 | Banco Sicredi | Ativo | Débito |
| 1.1.2.01.XXXX | Clientes a Receber (por cliente) | Ativo | Débito |
| 3.1.1.01 | Honorários Contábeis | Receita | Crédito |
| 4.x.x.xx | Despesas diversas | Despesa | Débito |
| 5.2.1.02 | Saldos de Abertura | PL | Crédito |

**Regra geral:**
- **Receitas (3.x):** só entram quando o serviço **FOI PRESTADO** no período corrente
- **Saldos de Abertura (5.2.1.02):** para dívidas de períodos **ANTERIORES** ao sistema

---

## 5. Família Leão — Separação Pessoal/Empresarial

### Regra fundamental:

> **Qualquer pagamento para membro da família que NÃO trabalha na empresa = Adiantamento a Sócios (Ativo 1.1.3.xx), NUNCA despesa operacional.**

### Membros e suas classificações:

| Pessoa | Relação | Trabalha na Ampla | Conta |
|--------|---------|-------------------|-------|
| Sérgio Carneiro Leão | Fundador | Sim (pró-labore) | 1.1.3.01 |
| Carla Leão | Esposa | Não | 1.1.3.02 (Adiantamento) |
| Nayara | Filha | **Sim** (R$ 6.000/mês salário) | 4.1.1.01 Salários |
| Victor Hugo Leão | Filho | **Sim** (R$ 6.000/mês salário) | 4.1.1.01 Salários |
| Sérgio Augusto | Filho | **Não** (mesada) | 1.1.3.03 (Adiantamento) |

### O que é despesa legítima da Ampla:
- Nayara e Victor Hugo (salários — trabalham na Ampla)
- Anuidades CRC de Carla/Sérgio (são contadores da Ampla)
- IPTU da sede própria
- Reformas no prédio da Ampla

### O que é Adiantamento a Sócios (não é despesa):
- Condomínios pessoais (Lago, Mundi)
- IPVA de veículos pessoais
- Energia de residências
- Sérgio Augusto (mesada — não trabalha na Ampla)
- AMPLA CONTABILIDADE LTDA (CNPJ 23893032000169) → pagamentos para ela = Adiantamento Sérgio

---

## 6. Fechamento Mensal — Como Funciona

### Duas tabelas de controle:

| Tabela | Propósito | Quem verifica |
|--------|-----------|---------------|
| `monthly_closings` | Trava o período (trigger `fn_check_closure_for_change`) | O trigger automático |
| `accounting_closures` | Registro gerencial do Dr. Cícero | Relatórios/dashboard |

### Para reabrir um período (emergência):
```sql
-- 1. Abrir a tabela que o trigger verifica
UPDATE monthly_closings
SET status = 'open'
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND reference_month = 'YYYY-MM-01';

-- 2. Também abrir accounting_closures
UPDATE accounting_closures
SET status = 'open'
WHERE tenant_id = 'a53a4957-fe97-4856-b3ca-70045157b421'
  AND year = YYYY AND month = MM;
```

### Para fechar novamente:
```sql
UPDATE monthly_closings SET status = 'closed' WHERE ...;
UPDATE accounting_closures SET status = 'closed' WHERE ...;
```

### Ativar modo manutenção (para INSERTs especiais):
```sql
INSERT INTO system_maintenance (key, value, updated_at)
VALUES ('accounting_maintenance', '{"enabled": true}'::jsonb, NOW())
ON CONFLICT (key) DO UPDATE SET value = '{"enabled": true}'::jsonb;

-- ... fazer as inserções ...

UPDATE system_maintenance SET value = '{"enabled": false}'::jsonb
WHERE key = 'accounting_maintenance';
```

---

## 7. Campos Obrigatórios ao Inserir em `accounting_entries`

O trigger `fn_validate_accounting_entry` exige:
- `source_type` (não pode ser NULL ou vazio)
- `internal_code` (não pode ser NULL ou vazio)

Valores usados por convenção:
- `source_type = 'manual'` para correções manuais
- `source_type = 'invoice'` para honorários
- `internal_code = 'ob_action_287_dez2024_fix20260302'` (padrão: tipo_cliente_periodo_datafix)

---

## 8. Fonte Única da Verdade

| Tabela | Uso |
|--------|-----|
| `accounting_entry_items` | **FONTE PRINCIPAL** — 9.500+ registros — usar para DRE, Balancete, Balanço |
| `accounting_entry_lines` | Tabela legada — ~1.100 registros — NÃO usar para relatórios |

Todos os relatórios (DRE, Balancete, Balanço Patrimonial, Fluxo de Caixa) devem ler de `accounting_entry_items`.

---

## 9. Identificação de Pagadores via QSA

Quando um PIX/TED chega com nome de pessoa física:
1. Dr. Cícero consulta a tabela `clients` e o campo QSA (`quadro_socios`)
2. Se a pessoa é sócia de **uma** empresa → classifica automaticamente
3. Se é sócia de **múltiplas** empresas → pergunta ao usuário qual empresa
4. Casos especiais conhecidos:
   - ENZO DONADI → sócio de Crystal, ECD e Verdi (perguntar)
   - IUVACI MILHOMEM → Restaurante Iuvaci (único)

---

## 10. Resumo dos Valores de Janeiro/2025 (após correção)

| Métrica | Valor |
|---------|-------|
| Receita de Honorários (3.1.1.01) | **R$ 211.193,80** |
| Receita provisionada (faturas criadas) | R$ 169.894,61 (129 faturas) |
| Diferença (honorários var. corretamente provisionados) | R$ 41.299,19 |
| Saldo Bancário (31/01/2025) | R$ 18.553,54 |
| Status do período | **FECHADO** |

> ⚠️ ATENÇÃO: O valor de R$ 211.193,80 é o valor correto para Janeiro/2025.
> Se o DRE mostrar R$ 356.002,48, significa que os lançamentos incorretos da ACTION
> voltaram e precisam ser corrigidos novamente.

---

## 11. Erros Históricos e Como Foram Corrigidos

### Erro 1: Lançamentos da ACTION criados APÓS o fechamento
- **Data do erro:** 2026-02-09 (um dia após o fechamento em 2026-02-08)
- **O que estava errado:** Dois ajustes de honorário variável creditavam 3.1.1.01 (Receita) em vez de 5.2.1.02 (Saldos de Abertura)
- **Impacto:** DRE inflado em R$ 144.808,68
- **Correção aplicada em:** 2026-03-02

### Erro 2: Transações bancárias com sinais invertidos (Sessão 25)
- PIX_DEB e LIQUIDACAO BOLETO estavam positivos
- Corrigidos para negativos via migration

### Erro 3: Saldo de abertura creditando Receita (Sessão 10)
- `smart-accounting` tratava `saldo_abertura` como `receita_honorarios`
- Corrigido: saldo de abertura vai para 5.2.1.02 (PL), não 3.1.1.01 (Receita)

---

*Documento criado pela Sessão 35 em 2026-03-02. Atualizar conforme novas regras forem definidas.*
