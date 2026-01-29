# 📊 RELATÓRIO DE DUPLICATAS - PLANO DE CONTAS AMPLA
## Data: 11/01/2025 | Total de Contas: 701

---

## 🔴 PROBLEMA 1: Duplicatas [CONSOLIDADO]
**Impacto:** ~120 contas duplicadas

Cada cliente aparece DUAS vezes — uma conta normal e outra idêntica com prefixo [CONSOLIDADO]:

| # | Código Original | Código [CONSOLIDADO] | Nome do Cliente |
|---|-----------------|---------------------|-----------------|
| 1 | 1.1.2.01.0012 | 1.1.2.01.0118 | FORMA COMUNICACAO VISUAL LTDA-ME |
| 2 | 1.1.2.01.0013 | 1.1.2.01.0119 | HOLDINGS BCS GUIMARAES LTDA |
| 3 | 1.1.2.01.0014 | 1.1.2.01.0120 | LAJES NUNES LTDA |
| 4 | 1.1.2.01.0017 | 1.1.2.01.0121 | MARIO LUCIO PINHEIRO MILAZZO - FAZ |
| 5 | 1.1.2.01.0045 | 1.1.2.01.0122 | LOPES CONSULTORIA LTDA |
| 6 | 1.1.2.01.0034 | 1.1.2.01.0123 | ARANTES NEGOCIOS LTDA |
| 7 | 1.1.2.01.0016 | 1.1.2.01.0124 | M.M LANCHES LTDA |
| 8 | 1.1.2.01.0009 | 1.1.2.01.0125 | COVALE USINAGEM INDUSTRIA E COMERCIO |
| 9 | 1.1.2.01.0020 | 1.1.2.01.0135 | ADMIR DE OLIVEIRA ALVES |
| 10 | 1.1.2.01.0115 | 1.1.2.01.0139 | ADMIR OLIVEIRA ALVES - DOMESTICA |
| 11 | 1.1.2.01.0105 | 1.1.2.01.0156 | HOKMA ELETROMONTAGEM LTDA |
| 12 | 1.1.2.01.0019 | 1.1.2.01.0158 | WESLEY MARTINS DE MOURA ME |
| 13 | 1.1.2.01.0032 | 1.1.2.01.0159 | PET SHOP E CAOPANHIA LTDA |
| 14 | 1.1.2.01.0026 | 1.1.2.01.0160 | AGROPECUARIA SCA LTDA |
| 15 | 1.1.2.01.0029 | 1.1.2.01.0161 | AMETISTA GESTAO EMPRESARIAL LTDA |
| ... | ... | ... | (mais ~105 duplicatas) |

**Causa provável:** Sistema importou clientes duas vezes — uma da tabela `clientes` e outra de alguma rotina de "consolidação".

---

## 🟠 PROBLEMA 2: Mesmo Cliente com Variações de Nome
**Impacto:** ~50 contas afetadas

### GRUPO: ELETROSOL (4 variações!)
```
1.1.2.01.0083  ELETROSOL ENERGIA SOLAR LTDA
1.1.2.01.0088  ELETROSOL SOLUCOES EM ENERGIA LTDA
1.1.2.01.0271  [CONSOLIDADO] ELETROSOL SOLUCOES EM ENERGIA LTDA
1.1.2.01.0335  [CONSOLIDADO] ELETROSOL ENERGIA SOLAR LTDA
1.1.2.01.0363  ELETROSOL SOLUCOES EM ENERGIA LTDA ← TRIPLICADO!
```

### GRUPO: D'ANGE (5 variações!)
```
1.1.2.01.0070  D'ANGE COMERCIO DE BICHO DE PELUCIA
1.1.2.01.0082  D'ANGE2 COMERCIO DE BICHO DE PELUCIA
1.1.2.01.0248  [CONSOLIDADO] D'ANGE COMERCIO...
1.1.2.01.0263  [CONSOLIDADO] D'ANGE2 COMERCIO...
1.1.2.01.0386  D'ANGE COMERCIO DE BICHO DE PELUCIA LTDA
1.1.2.01.0388  D'ANGE2 COMERCIO DE BICHO DE PELUCIA LTDA
1.1.2.01.0398  D ANGE2 COMERCIO DE BICHO DE PELUCIA LTD ← truncado!
```

### GRUPO: RAMAYOLE (4 variações!)
```
1.1.2.01.0066  RAMAYOLE CASA DOS SALGADOS EIRELI - ME
1.1.2.01.0238  [CONSOLIDADO] RAMAYOLE CASA DOS SALGADOS...
1.1.2.01.0366  RAMAYOLE CASA DOS SALGADOS LTDA
1.1.2.01.10001 RAMAYOLI INDUSTRIA DE SALGADOS EIRELI
```

### GRUPO: UNICAIXAS (3 variações)
```
1.1.2.01.0101  UNICAIXAS DESPACHANTE LTDA
1.1.2.01.0307  [CONSOLIDADO] UNICAIXAS DESPACHANTE LTDA
1.1.2.01.0361  UNICAIXAS DESPACHANTE LTDA ← duplicado!
1.1.2.01.10007 UNICAIXAS INDUSTRIA E FERRAMENTAS LTDA ← R$ 1.604,67
```

### GRUPO: COVAS PINTURAS (3 variações)
```
1.1.2.01.0080  COVAS SERVICOS DE PINTURAS LTDA
1.1.2.01.0260  [CONSOLIDADO] COVAS SERVICOS DE PINTURAS LTDA
1.1.2.01.0350  COVAS SERVICOS DE PINTURAS LTDA ← duplicado!
```

### GRUPO: PM ADMINISTRAÇÃO (3 variações)
```
1.1.2.01.0052  PM ADMINISTRACAO E SERVICOS LTDA
1.1.2.01.0208  [CONSOLIDADO] PM ADMINISTRACAO E SERVICOS LTDA
1.1.2.01.0360  PM ADMINISTRACAO E SERVICOS LTDA ← duplicado!
1.1.2.01.10004 PM ADMINSTRAÇÃO E SERVIÇOS ← R$ 1.864,10
```

---

## ⚪ PROBLEMA 3: Contas OBSOLETAS (12 contas)

| Código | Nome | Saldo |
|--------|------|-------|
| 3.1.01.001 | Honorários Contábeis (OBSOLETO) | R$ 0,00 |
| 4.1.02.004 | Telefone/Internet (OBSOLETO) | R$ 0,00 |
| 4.1.03.001 | Material de Escritório (OBSOLETO) | R$ 0,00 |
| 4.1.05 | Telefone e Internet (OBSOLETO) | R$ 0,00 |
| 4.1.08 | Manutenção e Reparos (OBSOLETO) | R$ 0,00 |
| 4.2.04 | FGTS (OBSOLETO) | R$ 0,00 |
| 4.2.05 | INSS Patronal (OBSOLETO) | R$ 0,00 |
| 4.2.07 | Vale Alimentação (OBSOLETO) | R$ 0,00 |
| 4.3.06 | Outros Impostos e Taxas (OBSOLETO) | R$ 0,00 |
| 5.3.02 | Prejuízos Acumulados (OBSOLETO) | R$ 0,00 |
| 2.3.03.01 | Saldo de Abertura - Disponibilidades (OBSOLETO) | R$ 0,00 |
| 2.3.03.02 | Saldo de Abertura - Clientes (OBSOLETO) | R$ 0,00 |

---

## 🔵 PROBLEMA 4: Contas "Dr. Cicero" Mal Posicionadas

| Código | Nome | Grupo Atual | Deveria Estar |
|--------|------|-------------|---------------|
| 1.1.3.01.0001 | Dr. Cicero: ADIANTAMENTO_SOCIO | Ativo | 1.1.3.04 (Adiant. Sócios) |
| 4.2.01.0001 | Dr. Cicero: DESPESA_GERAL | OK | OK |
| 4.2.99.01 | Dr. Cicero: Aluguel | OK | OK |
| 4.2.99.02 | Dr. Cicero: Utilidades | OK | OK |
| 4.2.99.03 | Dr. Cicero: Alimentação | OK | OK |
| 5.1.01.0001 | Dr. Cicero: CUSTOS_PESSOAL | Capital Social! | 4.2 (Despesas) |

---

## 🟣 PROBLEMA 5: Códigos Fora do Padrão

| Código | Nome | Dígitos | Problema |
|--------|------|---------|----------|
| 1.1.2.01.100 | TSD DISTRIBUIDORA DE CARTÕES LTDA | 3 | Deveria ser 0100 |
| 1.1.2.01.9999 | Pendente de Identificação | 4 | Código especial OK |
| 1.1.2.01.10000 | FORMA COMUNICAÇÃO VISUAL LTDA ME | 5 | Overflow |
| 1.1.2.01.10001 | RAMAYOLI INDUSTRIA DE SALGADOS EIRELI | 5 | Overflow |
| 1.1.2.01.10002 | AÇAI DO MADRUGA CAMPINAS LTDA | 5 | Overflow |
| ... | (mais 12 contas com 5 dígitos) | 5 | Overflow |

---

## 🔴 PROBLEMA 6: Patrimônio Líquido Duplicado

O PL aparece em DOIS lugares:

### Opção A (dentro do Passivo):
```
2.3    PATRIMÔNIO LÍQUIDO
2.3.03.01  Saldo de Abertura - Disponibilidades (OBSOLETO)
2.3.03.02  Saldo de Abertura - Clientes (OBSOLETO)
```

### Opção B (grupo próprio):
```
5      PATRIMÔNIO LÍQUIDO
5.1    CAPITAL SOCIAL
5.2    RESERVAS
5.3    LUCROS OU PREJUÍZOS
5.4    Capital Social (duplicado!)
```

**Estrutura correta:** PL deveria estar APENAS no grupo 2.3 ou APENAS no grupo 5.

---

## 📈 RESUMO ESTATÍSTICO

| Métrica | Quantidade |
|---------|------------|
| Total de contas | 701 |
| Contas de clientes | ~450 |
| Duplicatas [CONSOLIDADO] | ~120 |
| Variações de nome | ~50 |
| Contas OBSOLETAS | 12 |
| Dr. Cicero mal posicionadas | 2 |
| Códigos fora do padrão | ~15 |
| **Contas que deveriam existir** | **~450** |
| **Contas a remover/desativar** | **~250** |

---

## ✅ PLANO DE AÇÃO RECOMENDADO

### Fase 1: Backup e Preparação
1. ✅ Criar backup completo da tabela `plano_contas`
2. ✅ Criar backup dos lançamentos contábeis vinculados

### Fase 2: Limpeza de Baixo Risco
1. ⚪ Desativar contas OBSOLETAS (12 contas)
2. 🔵 Reposicionar contas Dr. Cicero (2 contas)

### Fase 3: Unificação de Duplicatas
1. 🔴 Unificar [CONSOLIDADO] com originais (transferir saldos)
2. 🟠 Unificar variações de nome (análise caso a caso)

### Fase 4: Padronização
1. 🟣 Padronizar códigos para 4 dígitos
2. 🔵 Reorganizar estrutura do PL

### Fase 5: Validação
1. ✅ Verificar equação contábil (D = C)
2. ✅ Testar balancete
3. ✅ Validar DRE

---

## 🚨 ATENÇÃO

**NÃO execute limpeza sem backup!**

O script `LIMPEZA_PLANO_CONTAS_AMPLA.sql` contém:
- Queries de diagnóstico (seguras)
- Comandos de limpeza (comentados, execute manualmente)
- Função `fn_limpar_plano_contas()` para automação

Execute primeiro: `SELECT * FROM fn_limpar_plano_contas(FALSE);` para simular.
