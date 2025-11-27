# 🚀 GUIA DE INÍCIO RÁPIDO - Sistema Ampla Contabilidade

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### ✅ FASE 1: Configuração do Banco de Dados (AGORA!)

1. **Executar SQLs no Supabase** 🔥 PRIORITÁRIO
   - Abrir arquivo: `EXECUTE_SQL_NO_SUPABASE.md`
   - Seguir instruções passo a passo
   - Executar SQL 1: Criar tabela de saldo de abertura
   - Executar SQL 2: Configurar conta SICREDI
   - Executar SQL 3: Verificar instalação

**Tempo estimado:** 5 minutos

---

### ✅ FASE 2: Cadastrar Saldos de Abertura (ANTES DE IMPORTAR EXTRATOS!)

1. **Levantar débitos de 2024**
   - Verificar planilha de controle atual
   - Listar todos os clientes com honorários pendentes de 2024
   - Anotar: Cliente, Competência (MM/YYYY), Valor, Vencimento

2. **Cadastrar no sistema**
   - Acessar: `http://localhost:5173/client-opening-balance`
   - Clicar em "Adicionar Saldo de Abertura"
   - Para cada cliente:
     - Selecionar o cliente
     - Adicionar cada competência devida (ex: 01/2024, 03/2024, etc)
     - Informar valor e data de vencimento
     - Salvar

**Tempo estimado:** 30-60 minutos (depende do número de clientes)

**IMPORTANTE:** ⚠️ Não pule esta etapa! O sistema precisa saber o que cada cliente deve de 2024 para fazer a conciliação correta.

---

### ✅ FASE 3: Importar Extratos Bancários

1. **Organizar arquivos da pasta "banco"**
   - Verificar que você tem:
     - Arquivos OFX (extratos bancários do SICREDI)
     - Arquivos Excel (relatórios de boletos pagos/pendentes)

2. **Fazer importação em lote**
   - Acessar: `http://localhost:5173/bank-folder-import`
   - Na seção "Extratos OFX":
     - Clicar em "Selecionar arquivos OFX"
     - Selecionar todos os arquivos .ofx
   - Na seção "Relatórios Excel":
     - Clicar em "Selecionar arquivos Excel"
     - Selecionar todos os arquivos .xlsx do banco
   - Clicar em "Importar Tudo"
   - Aguardar processamento (barra de progresso)

**Tempo estimado:** 5-10 minutos

---

### ✅ FASE 4: Revisar Conciliação Automática

1. **Acessar dashboard de conciliação**
   - URL: `http://localhost:5173/bank-reconciliation`
   - Visualizar:
     - Transações conciliadas automaticamente ✅
     - Transações pendentes de identificação ⚠️
     - Saldos por status

2. **Revisar e ajustar**
   - Clicar em transações pendentes
   - Associar manualmente se necessário
   - Confirmar pagamentos

**Tempo estimado:** 20-30 minutos (primeira vez)

---

### ✅ FASE 5: Verificação Final

1. **Conferir saldos dos clientes**
   - Acessar: `http://localhost:5173/clients`
   - Clicar em cada cliente para ver detalhes
   - Verificar:
     - Saldo de abertura (2024)
     - Honorários regulares (2025+)
     - Status de pagamento

2. **Validar relatórios**
   - Acessar: `http://localhost:5173/dashboard`
   - Conferir métricas:
     - Total a receber
     - Taxa de inadimplência
     - Receitas do mês

**Tempo estimado:** 15 minutos

---

## 🔄 FLUXO DE TRABALHO MENSAL (Depois da Configuração Inicial)

### Todo Início de Mês:

1. **Baixar arquivos do banco**
   - Acessar Internet Banking SICREDI
   - Baixar extrato OFX do mês anterior
   - Baixar relatório Excel de boletos

2. **Importar arquivos**
   - Acessar: `/bank-folder-import`
   - Upload dos arquivos
   - Aguardar processamento automático

3. **Revisar conciliações**
   - Acessar: `/bank-reconciliation`
   - Verificar matches automáticos
   - Resolver pendências manualmente

4. **Atualizar clientes inadimplentes**
   - Acessar: `/defaulters`
   - Verificar lista de inadimplentes
   - Tomar ações de cobrança

**Tempo estimado:** 15-20 minutos/mês

---

## 📊 PÁGINAS PRINCIPAIS DO SISTEMA

### 🏠 Principal
- `/dashboard` - Dashboard executivo com métricas
- `/clients` - Gestão de clientes
- `/client-opening-balance` - Saldo de abertura (2024)

### 💰 Financeiro
- `/client-fees` - Honorários mensais recorrentes
- `/defaulters` - Análise de inadimplência
- `/collection-orders` - Ordens de cobrança

### 🏦 Conciliação Bancária
- `/bank-folder-import` - **NOVO!** Importação em lote de arquivos
- `/bank-reconciliation` - Conciliação de extratos
- `/pix-reconciliation` - Reconciliação de PIX

### 📈 Relatórios
- `/cash-flow` - Fluxo de caixa
- `/balance-sheet` - Balanço patrimonial
- `/balancete` - Balancete contábil

---

## 🆘 SOLUÇÃO DE PROBLEMAS

### ❌ "Tabela client_opening_balance não existe"
**Solução:** Execute o SQL do arquivo `EXECUTE_SQL_NO_SUPABASE.md` - Seção 1

### ❌ "Conta bancária não encontrada"
**Solução:** Execute o SQL do arquivo `EXECUTE_SQL_NO_SUPABASE.md` - Seção 2

### ❌ "Erro ao processar arquivo Excel"
**Possíveis causas:**
1. Arquivo corrompido → Baixe novamente do banco
2. Formato não reconhecido → Verifique se é .xlsx ou .xls
3. Colunas com nomes diferentes → Entre em contato para ajustar o parser

### ❌ "Pagamento não foi conciliado automaticamente"
**Soluções:**
1. Verifique se o "Nosso Número" do boleto está correto na fatura
2. Verifique se o saldo de abertura foi cadastrado para aquela competência
3. Faça a conciliação manual em `/bank-reconciliation`

### ❌ "Cliente não aparece na busca"
**Solução:** Verifique se o cliente está ativo: `/clients` → Filtro "Ativos"

---

## 📞 SUPORTE

Para dúvidas ou problemas:
1. Verifique este guia primeiro
2. Consulte o `ROADMAP.md` para detalhes técnicos
3. Consulte `EXECUTE_SQL_NO_SUPABASE.md` para SQLs específicas

---

## 🎯 METAS DA PRIMEIRA SEMANA

- [ ] Executar SQLs no Supabase ✅
- [ ] Cadastrar saldos de abertura de todos os clientes ✅
- [ ] Importar extratos bancários de dezembro/2024 ✅
- [ ] Fazer primeira conciliação bancária ✅
- [ ] Validar que tudo está funcionando ✅

**Depois disso, o sistema estará 100% operacional! 🎉**

---

## 📅 CRONOGRAMA SUGERIDO

### Segunda-feira
- Manhã: Executar SQLs e configurar sistema
- Tarde: Começar cadastro de saldos de abertura

### Terça-feira
- Manhã: Continuar cadastro de saldos
- Tarde: Finalizar cadastro e validar

### Quarta-feira
- Manhã: Baixar e organizar arquivos bancários
- Tarde: Importar arquivos e testar conciliação

### Quinta-feira
- Manhã: Revisar conciliações e ajustar pendências
- Tarde: Validar relatórios e dashboards

### Sexta-feira
- Sistema rodando 100% operacional! 🚀

---

## 🎓 DICAS IMPORTANTES

1. **Sempre cadastre o saldo de abertura ANTES de importar extratos**
   - Isso garante que o sistema identifique corretamente pagamentos antigos

2. **Faça backup regular dos arquivos da pasta "banco"**
   - Mantenha cópias dos OFX e Excel por pelo menos 12 meses

3. **Revise a conciliação toda semana**
   - Não deixe acumular transações pendentes

4. **Atualize os honorários mensais no início do mês**
   - O sistema gera automaticamente se configurado

5. **Use os relatórios para tomada de decisão**
   - Dashboard executivo mostra saúde financeira em tempo real

---

**Boa sorte! 🚀 O sistema está pronto para uso!**
