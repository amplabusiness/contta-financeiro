# 🎯 Sistema de Importação de Cobrança - Guia Rápido

## O Problema que foi Resolvido

Você tinha transações no banco como **"LIQ.COBRANCA SIMPLES-COB000005"** mostrando R$ 5.913,78 em um lançamento único, mas na verdade esse valor era composto por **5 clientes diferentes**:

1. PET SHOP E COMPANHIA LTDA - R$ 1.412,00
2. ELETROSOL ENERGIA SOLAR LTDA - R$ 300,00
3. D ANGE2 COMERCIO DE BICHO DE PELUCIA LTD - R$ 760,00
4. FAZENDA DA TOCA PARTICIPACOES LTDA - R$ 2.029,78
5. JR SOLUCOES INDUSTRIAIS LTDA - R$ 1.412,00

**Total: R$ 5.913,78** ✅

Antes, o sistema não conseguia rastrear quais clientes haviam pago. Agora consegue!

---

## 📋 Como Usar

### Passo 1: Localize o Arquivo de Cobrança
- Arquivo: `banco/clientes boletos jan.csv`
- Formato: CSV com separador ponto-vírgula (;)
- Colunas: 
  - Documento (COB000005)
  - Número do boleto
  - Pagador (Nome do Cliente)
  - Data Vencimento
  - Data Liquidação
  - Valor boleto
  - Valor recebido
  - Data do extrato

### Passo 2: Abra a Super Conciliação
- Vá para: **Sistema > Super Conciliação**
- Selecione o mês (janeiro 2025)
- Veja as transações pendentes

### Passo 3: Clique em "Importar Cobrança"
- Botão localizado no topo direito, após o seletor de mês
- Abre um diálogo de importação

### Passo 4: Selecione o Arquivo
- Clique em "Selecione o arquivo CSV"
- Navegue para: `banco/clientes boletos jan.csv`
- O arquivo será processado automaticamente

### Passo 5: Veja os Resultados
O sistema mostrará:

```
✅ Importado: 47 cobranças
✅ 123 clientes processados
✅ Total: R$ 298.527,29
✅ 35 cobranças conciliadas com banco
⚠️  12 não encontradas no banco (pode estar em outro mês)
```

Para cada cobrança (COB000005, COB000007, etc):
- **Nome**: COB000005
- **Status**: Conciliada ✅ ou Não encontrada ⚠️
- **Data Extrato**: 03/01/2025
- **Total**: R$ 5.913,78
- **Clientes**: 5 encontrados, 5 invoices criadas
- **Detalhe de cada cliente**:
  - PET SHOP E COMPANHIA LTDA - R$ 1.412,00 ✅ (Invoice criada/vinculada)
  - ELETROSOL ENERGIA SOLAR LTDA - R$ 300,00 ✅
  - etc.

---

## 🔧 Internamente, o Sistema Faz:

### 1. **Parse do CSV**
```
Lê arquivo e valida formato
Interpreta valores (1.412,00 → 1412.00)
Mapeia datas (DD/MM/YYYY)
```

### 2. **Agrupa por Documento**
```
COB000005 (5 clientes) = R$ 5.913,78
COB000007 (4 clientes) = R$ 3.832,45
COB000022 (15 clientes) = R$ 18.543,21
...
```

### 3. **Para Cada Cobrança**
```
✅ Busca clients.name no banco (com tolerância de espaços/acentos)
✅ Busca ou cria invoices com o valor e cliente
✅ Marca invoice como "paid" e seta paid_date
✅ Procura bank_transaction correspondente (por descrição, valor, data)
✅ Vincula invoice → bank_transaction
```

### 4. **Resultado Final**
```
Invoices marcadas como "paid" ✅
Bank_transactions vinculadas a invoices ✅
Clientes rastreáveis para cada cobrança ✅
Relatórios de reconciliação funcionando ✅
```

---

## 📊 Exemplo Prático

### Antes (Problema):
```
Bank Transaction:
├─ Documento: LIQ.COBRANCA SIMPLES-COB000005
├─ Valor: R$ 5.913,78
├─ Data: 03/01/2025
└─ Cliente Relacionado: NULL ❌

Invoices:
├─ PET SHOP... R$ 1.412,00 - status: pending, paid_date: NULL
├─ ELETROSOL... R$ 300,00 - status: pending, paid_date: NULL
├─ D ANGE2... R$ 760,00 - status: pending, paid_date: NULL
└─ ... (sem ligação com o bank_transaction)
```

### Depois (Resolvido):
```
Bank Transaction:
├─ Documento: LIQ.COBRANCA SIMPLES-COB000005
├─ Valor: R$ 5.913,78
├─ Data: 03/01/2025
└─ Cliente Relacionado: 5 invoices vinculadas ✅

Invoices (criadas ou atualizadas):
├─ PET SHOP... R$ 1.412,00 - status: paid ✅, paid_date: 02/01
├─ ELETROSOL... R$ 300,00 - status: paid ✅, paid_date: 02/01
├─ D ANGE2... R$ 760,00 - status: paid ✅, paid_date: 02/01
├─ FAZENDA... R$ 2.029,78 - status: paid ✅, paid_date: 02/01
└─ JR SOLUCOES... R$ 1.412,00 - status: paid ✅, paid_date: 02/01

Relacionamento:
└─ Todas as 5 invoices → bank_transaction COB000005 ✅
```

---

## 🎓 Fluxo da Conciliação

```
1. Usuário clica em "Importar Cobrança"
        ↓
2. Seleciona arquivo CSV (banco/clientes boletos jan.csv)
        ↓
3. Sistema parse CSV
        ↓
4. Agrupa por Documento (COB000005, etc)
        ↓
5. Para cada cliente no documento:
   ├─ Busca cliente no banco
   ├─ Cria ou atualiza invoice
   └─ Marca como "paid" com data
        ↓
6. Busca bank_transaction correspondente
        ↓
7. Vincula todas as invoices ao bank_transaction
        ↓
8. Mostra relatório de resultados
        ↓
9. Usuário vê "Conciliada ✅" para transações validadas
```

---

## 🚨 Troubleshooting

### "Cobrança não encontrada na conciliação"
- ❌ Pode estar em arquivo de outro mês
- ❌ A data do extrato pode estar diferente
- ❌ O valor pode ter sido ajustado (ex: juros/desconto)
- ✅ Solução: Verificar relatório do banco manual

### "Cliente não encontrado"
- ❌ Nome pode estar digitado diferente no banco
- ❌ Cliente pode ter sido deletado
- ✅ Solução: Criar cliente manualmente antes de importar

### "Arquivo inválido"
- ❌ Salvar em CSV, não em XLSX
- ❌ Verificar separador é ponto-vírgula (;)
- ❌ Não alterar cabeçalho do arquivo
- ✅ Solução: Verificar arquivo source_system_entries.json ou re-exportar do banco

---

## 📚 Arquivos Criados/Modificados

### Novos Arquivos:
1. `src/utils/parseCobrancaFile.ts` - Parser do CSV
2. `src/services/cobrancaImportService.ts` - Lógica de importação
3. `src/components/CobrancaImporter.tsx` - UI com diálogo

### Modificados:
1. `src/pages/SuperConciliation.tsx` - Adicionado botão

---

## 🔍 Próximas Melhorias

- [ ] Importar múltiplos arquivos de meses diferentes simultaneamente
- [ ] Suportar formatação XLSX (Excel)
- [ ] Validação de duplicatas (mesma cobrança importada 2x)
- [ ] Relatório de discrepâncias (cliente no arquivo mas não no banco)
- [ ] Exportar relatório conciliado em PDF
- [ ] Integração automática com Bling (quando houver API)

---

## 💡 Tips

1. **Sempre começar pelo mês de janeiro** - Os arquivos estão prontos
2. **Verificar saldos antes e depois** - Devem concordar com o OFX
3. **Se houver problema, desfazer é fácil** - Clique em "Editar" depois para reclassificar
4. **O Dr. Cícero aprende com as importações** - Próximas transações similares serão mais rápidas

---

Aproveite! 🚀
