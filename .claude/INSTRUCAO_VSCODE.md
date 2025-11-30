# INSTRUÇÕES PARA CLAUDE CODE (VSCode)

## AUTORIDADE: TOTAL
O usuário autorizou alterações conforme necessário. Você tem autonomia para:
- Resolver conflitos usando a melhor versão
- Fazer ajustes de código se necessário
- Fazer deploy de Edge Functions
- Fazer commits e push para main

---

## SOBRE A AMPLA CONTABILIDADE

**Ampla Contabilidade** - Escritório com mais de **30 anos de experiência** (desde os anos 90)
- **Site:** [www.amplabusiness.com.br](https://www.amplabusiness.com.br)
- **Instagram:** [@amplacontabilidade](https://instagram.com/amplacontabilidade)
- **Missão:** Fornecer informações e diferenciais competitivos, visando o desenvolvimento máximo de seus clientes

### Serviços Oferecidos:
- **Auditoria** - Exame de documentos e registros
- **Serviços Jurídicos** - Direito empresarial, tributário, trabalhista, civil e penal
- **Departamental** - Fiscal, DP, legalizações e contabilidade geral
- **Consultoria** - Planejamento estratégico, gestão e administração tributária
- **Terceirização** - Tesouraria, controladoria e gestão de RH

### Estrutura Física:
- **5 TVs** distribuídas: Recepção, DP, Fiscal, RH, Diretoria
- **Escritório completo** com áreas especializadas

---

## STATUS ATUAL (30/11/2025)

### ✅ PRONTO PARA PRODUÇÃO - Segunda-feira (01/12/2025)
- **Frontend:** ampla.app.br (Vercel) - **SEGURO** ✅
- **Backend:** Supabase (xdtlhzysrpoinqtsglmr) - **CONFIGURADO** ✅
- **CI/CD:** GitHub Actions configurado - **PENDENTE SECRETS** ⚠️

### Análise de Segurança (Concluída):
- ✅ Nenhum secret exposto no frontend
- ✅ Apenas variáveis VITE_* públicas (anon key)
- ✅ .env incluído no .gitignore
- ✅ Credenciais protegidas

### Concluído Hoje (30/11 - Sessão Atual):
1. **Reorganização do Menu** - Estrutura por fluxo financeiro
2. **Sistema de Diálogo IA-Humano** - Classificação interativa de transações
3. **Componente AIClassificationDialog** - Modal para treinar a IA
4. **Tabelas de Aprendizado** - Entidades, padrões e histórico
5. **Unificação de Importação** - BankImport como único ponto de entrada
6. **Limpeza de Conta Duplicada** - Desativada conta Sicredi com saldo zero
7. **Sistema de Adiantamentos a Sócios** - Contas e categorias para controle
8. **Centros de Custo** - AMPLA (escritório) e SERGIO (sócio)
9. **Equipe de Agentes IA** - Criada identidade para os agentes (6 agentes)
10. **AITeamBadge** - Badge com equipe IA no sidebar
11. **AIAssistantChat** - Chat IA-Humano para formulários
12. **Cadastro Empresa/Funcionários** - Perfil, sócios, família, funcionários, terceiros
13. **Sistema de Estoque/Compras** - 36 produtos, fornecedores, lista de compras
14. **Sistema de Consultoria Trabalhista** - Dr. Advocato + Sr. Empresário
15. **Base de Jurisprudência** - Decisões TST/TRT para embasar soluções
16. **Estratégias de Solução** - 6 modelos (MEI, CLT, Sócio, Empresa, Diarista, Terceirização)
17. **Sistema de Folha eSocial** - Rubricas, INSS/IRRF, cálculo automático
18. **Detalhamento Salarial** - Carteira vs Por Fora com justificativa

### ✅ Concluído (30/11 - Última Sessão Claude Code):
19. **Tela de Login Redesenhada (Auth.tsx)** - Layout split com branding Ampla
    - Lado esquerdo: gradiente azul, diferenciais, serviços, missão
    - Lado direito: formulário de login/cadastro
    - Logos SVG criadas: `/public/logo-ampla.svg` e `/public/logo-ampla-white.svg`
    - Mobile responsive com fallback para ícone
20. **CRUD Completo Payroll.tsx (Folha de Pagamento)** - Funcionários
    - Criar novo funcionário
    - Editar funcionário existente
    - Suspender/Reativar funcionário
    - Excluir funcionário
    - Toggle para ver inativos
    - DropdownMenu com ações em cada linha
    - Dialog de criação/edição
    - AlertDialog de confirmação
21. **CRUD Completo VideoContent.tsx (Vídeos e TVs)**
    - Aba de Sugestões IA com chat e base de conhecimento Ampla
    - Criar/Editar/Excluir vídeos
    - Criar/Editar/Ativar/Desativar/Excluir TVs (telas)
    - DropdownMenu com ações
    - Dialogs e AlertDialogs de CRUD
22. **CRUD Completo Inventory.tsx (Estoque e Compras)**
    - Criar/Editar/Desativar/Excluir produtos
    - Criar/Editar/Excluir fornecedores
    - Toggle para ver produtos inativos
    - Botão "Novo Produto" e "Novo Fornecedor"
    - DropdownMenu com ações em cada item
    - Dialog de criação/edição de produto (nome, categoria, unidade, estoques, preço, fornecedor)
    - Dialog de criação/edição de fornecedor (nome, categoria, telefone, observações)
    - AlertDialog de confirmação de exclusão
    - Baixa de estoque (consumo) mantida

### Arquivos Modificados/Criados (Última Sessão):
- `src/pages/Auth.tsx` - Redesign completo com branding Ampla
- `src/pages/Payroll.tsx` - CRUD funcionários completo
- `src/pages/VideoContent.tsx` - Aba IA + CRUD vídeos/TVs
- `src/pages/Inventory.tsx` - CRUD produtos/fornecedores completo
- `public/logo-ampla.svg` - Logo colorida (fundo claro)
- `public/logo-ampla-white.svg` - Logo branca (fundo azul)

### Concluído Anteriormente (29/11):
1. **Sistema Contábil Completo** - Plano de contas conforme NBC/CFC
2. **Conta Bancária Sicredi** - Cadastrada com saldo de abertura R$ 90.725,10
3. **Lançamento de Abertura** - Registrado em 31/12/2024
4. **Importação OFX com IA** - Classificação automática implementada

---

## ESTRUTURA DO MENU (AppSidebar.tsx)

Menu reorganizado por fluxo de trabalho financeiro:

### Principal
- Dashboard, Executivo, Fluxo de Caixa

### Banco
- **Contas Bancárias** (`/bank-accounts`) - Cadastro de contas
- **Importar Extrato** (`/bank-import`) - ÚNICO ponto de importação OFX
- **Conciliação** (`/bank-reconciliation`)
- **Super Conciliador** (`/super-conciliador`)

### Contas a Receber
- Honorários, Gerar Honorários, Análise
- Reajuste por SM, Inadimplência, Cobrança, Negociação

### Contas a Pagar
- **Despesas** (`/expenses`) - Gastos operacionais do escritório
- **Fornecedores** (`/accounts-payable`) - Obrigações com terceiros
- **Despesas Recorrentes** (`/recurring-expenses`)

### Clientes
- Clientes, Pro-Bono, Grupos Financeiros, Análise por Sócios, Contratos e destratos

### Contabilidade
- Plano de Contas, Saldo de Abertura, Balancete, DRE, Balanço, Livros

### Importações
- Clientes, Honorários, Despesas, Upload Automático

### Ferramentas IA
- Contador IA, Gestor IA, Rede Neural, Enriquecimento, Configurações

---

## SISTEMA DE DIÁLOGO IA-HUMANO

### Conceito:
A IA aprende com o humano nos primeiros momentos. Exemplo:
- Transação: "PAGAMENTO PIX - SERGIO CARNEIRO LEAO"
- IA pergunta: "Quem é Sérgio Carneiro Leão?"
- Humano responde: "É um sócio da empresa"
- IA salva o padrão e usa nas próximas classificações

### Componentes:

#### 1. AIClassificationDialog (`src/components/AIClassificationDialog.tsx`)
- Modal interativo para classificar transações
- Tabs: Classificação | Quem é?
- Mostra sugestão da IA com nível de confiança
- Permite salvar entidade e padrão para uso futuro

#### 2. Tabelas de Aprendizado (Migration `20251129280000`)

| Tabela | Descrição |
|--------|-----------|
| `ai_known_entities` | Entidades conhecidas (pessoas, empresas) |
| `ai_classification_patterns` | Padrões de classificação aprendidos |
| `ai_classification_history` | Histórico para treinamento |
| `ai_pending_questions` | Perguntas da IA aguardando resposta |

#### 3. Funções SQL

```sql
-- Normaliza texto para matching
normalize_for_matching(input_text TEXT) RETURNS TEXT

-- Busca padrão conhecido
find_known_pattern(description TEXT, txn_type TEXT, amount DECIMAL)
RETURNS TABLE (pattern_id, category, debit_account, credit_account, entity_name, confidence)
```

### Fluxo na BankImport:

1. **Preview do OFX** → Botão "Classificar Manualmente"
2. **Após importar com IA** → Botão "Revisar Classificações (X pendentes)"
3. **Aprendizado salvo** → Entidades, padrões e histórico

---

## ESTRUTURA CONTÁBIL

| Grupo | Descrição | Contas Especiais |
|-------|-----------|------------------|
| 1 | ATIVO | 1.1.1.02 Banco Sicredi, 1.1.3.04.01 Adiantamentos - Sergio |
| 2 | PASSIVO | 2.1.1.01 Fornecedores, 2.1.4.01 AFAC - Sergio |
| 3 | RECEITAS | 3.1.1.01 Honorários |
| 4 | DESPESAS | 4.1.x a 4.9.x |
| 5 | PATRIMÔNIO LÍQUIDO | 5.3.02.01 Saldo de Abertura, 5.3.03.01 Ajustes |

### Tratamento de Recebimentos:
- **Período atual**: D-Banco C-Receita
- **Períodos anteriores**: D-Banco C-5.3.03.01 (Ajustes Positivos)

### Tratamento de Despesas de Sócios:

**Quando a AMPLA paga despesas pessoais do sócio:**
```
D - 1.1.3.04.01 Adiantamentos - Sergio Carneiro Leão (Ativo)
C - 1.1.1.02 Banco Sicredi
```
→ A empresa tem a RECEBER do sócio (crédito)

**Quando o sócio devolve o dinheiro:**
```
D - 1.1.1.02 Banco Sicredi
C - 1.1.3.04.01 Adiantamentos - Sergio (baixa o crédito)
```

**Se preferir transformar em AFAC (aumento de capital):**
```
D - 1.1.3.04.01 Adiantamentos - Sergio (baixa)
C - 5.1.03 Capital Social Integralizado
```

**AFAC - Adiantamento para Futuro Aumento de Capital:**
- Usado quando o sócio EMPRESTA dinheiro para a empresa
- Fica no PASSIVO (empresa deve ao sócio)
- Só usar quando o sócio não quer receber de volta
```
D - 1.1.1.02 Banco (entra dinheiro)
C - 2.1.4.01 AFAC - Sergio (obrigação)
```

---

## CENTROS DE CUSTO

| Código | Nome | Descrição |
|--------|------|-----------|
| AMPLA | Ampla Contabilidade | Despesas operacionais do escritório |
| SERGIO | Sergio Carneiro Leão | Despesas pessoais do sócio |
| SERGIO.IMOVEIS | Imóveis | IPTU, condomínios, água, energia |
| SERGIO.VEICULOS | Veículos | IPVA, combustível, manutenção |
| SERGIO.PESSOAL | Despesas Pessoais | Saúde, personal, anuidades CRC |
| SERGIO.TELEFONE | Telefone | Linhas telefônicas pessoais |
| SERGIO.OUTROS | Outros | Outras despesas |

### Categorias de Despesas do Sócio (expense_categories):

**Imóveis:**
- Água, Energia, Gás
- Condomínio Galeria Nacional, Lago, Mundi
- IPTU Apartamento, Salas 301/302/303, Vila Abajá
- Obras Lago

**Veículos:**
- IPVA BMW, Biz, CG, Carretinha

**Pessoal:**
- Plano de Saúde
- Personal (Antonio Leandro)
- Anuidade CRC Sergio/Carla
- Tharson Diego

**Telefone/Internet:**
- Telefone, Internet

---

## EQUIPE DE AGENTES IA

A Ampla Contabilidade possui uma equipe de agentes de IA que trabalham juntos:

| Agente | Nome | Função | Especialidades |
|--------|------|--------|----------------|
| 🧮 | **Dr. Cícero** | Contador IA | Lançamentos Contábeis, Plano de Contas, NBC/CFC, Balanço, DRE |
| 🧠 | **Prof. Milton** | MBA Finanças | Fluxo de Caixa, Análise de Custos, KPIs, Projeções, Orçamentos |
| 🤖 | **Dra. Helena** | Gestora IA | Gestão, Metas, Indicadores, Processos, Estratégia |
| 🌐 | **Atlas** | Rede Neural | Aprendizado, Padrões, Classificação, Automação, Previsões |
| ⚖️ | **Dr. Advocato** | Advogado Trabalhista IA | CLT, Jurisprudência TST/TRT, Riscos Trabalhistas, Contratos, Súmulas |
| 🏢 | **Sr. Empresário** | Estrategista Empresarial | Sociedades, Holdings, Terceirização, Planejamento, MEI/ME |
| 📈 | **Sr. Vendedor** | Consultor Comercial IA | Vendas, Prospecção, Retenção, Indicações, Scripts |
| 📢 | **Sra. Marketing** | Gestora de Marketing IA | Marketing, Incentivos, PLR, Vídeos, Campanhas, Treinamentos |

### Componentes de Interface:

- **AITeamBadge** (`src/components/AITeamBadge.tsx`)
  - Mostra a equipe IA de forma discreta
  - Variantes: `full`, `compact`, `minimal`
  - Tooltips com descrição de cada agente
  - Exibido no rodapé do sidebar

- **AIAssistantChat** (`src/components/AIAssistantChat.tsx`)
  - Chat IA-Humano para formulários
  - Carrega perguntas pendentes da tabela `ai_pending_questions`
  - Permite respostas rápidas ou customizadas
  - Mapeia contexto para agente apropriado

---

## EDGE FUNCTIONS DE IA

| Função | Descrição | Status |
|--------|-----------|--------|
| `ai-bank-transaction-processor` | Processa transações e gera lançamentos | ✅ Deployado |
| `ai-business-manager` | Gestor empresarial | ✅ Migrado Gemini |
| `ai-accountant-background` | Validador contábil | ✅ Migrado Gemini |
| `ai-accounting-engine` | Motor contábil | ✅ Ativo |
| `ai-expense-classifier` | Classificador de despesas | ✅ Ativo |

---

## CREDENCIAIS

### Supabase
- **Project ID**: `xdtlhzysrpoinqtsglmr`
- **URL**: `https://xdtlhzysrpoinqtsglmr.supabase.co`

### Secrets configurados (Supabase):
- `OPENAI_API_KEY` - API OpenAI (GPT-5.1, Sora 2, TTS)
- `GEMINI_API_KEY` - API do Google Gemini
- `CNPJA_API_KEY` - API CNPJA
- `SUPABASE_SERVICE_ROLE_KEY` - Chave de serviço
- `SUPABASE_URL` - URL do projeto

### Secrets necessários (GitHub Actions):
- `SUPABASE_ACCESS_TOKEN` - Token para deploy migrations
- `VERCEL_TOKEN` - Token para deploy frontend
- `VERCEL_ORG_ID` - ID da organização Vercel
- `VERCEL_PROJECT_ID` - ID do projeto Vercel

---

## CI/CD - DEPLOY AUTOMÁTICO

### Fluxo:
```
Commit → GitHub → Actions → Supabase (migrations) + Vercel (frontend)
```

### O que acontece automaticamente:
1. **Push para main** dispara GitHub Actions
2. **Supabase**: Aplica todas migrations pendentes
3. **Edge Functions**: Deploy de todas as funções
4. **Vercel**: Build e deploy do React
5. **Notificação**: Resumo no GitHub

### Arquivos de CI/CD:
- `.github/workflows/deploy.yml` - Deploy principal
- `.github/workflows/feature-implementation.yml` - Evolução contínua
- `.github/SETUP_CI_CD.md` - Documentação de configuração

### Como configurar:
Ver documento completo em: `.github/SETUP_CI_CD.md`

### Script de Configuração Automática:
```powershell
# Execute no PowerShell:
.\scripts\setup-cicd.ps1
```

O script automaticamente:
1. Verifica se gh CLI está instalado e autenticado
2. Detecta o repositório GitHub
3. Lê IDs do Vercel de `.vercel/project.json` (se existir)
4. Configura todos os secrets necessários

---

## COMANDOS ÚTEIS

### Deploy de Edge Functions
```bash
npx supabase functions deploy ai-bank-transaction-processor --project-ref xdtlhzysrpoinqtsglmr
```

### Migrações
```bash
npx supabase db push --linked
```

### Git
```bash
git add . && git commit -m "mensagem" && git push origin main
```

---

## ARQUIVOS PRINCIPAIS

### Menu e Navegação:
- `src/components/AppSidebar.tsx` - Menu lateral reorganizado (com AITeamBadge no rodapé)

### Componentes de IA:
- `src/components/AITeamBadge.tsx` - Badge da equipe IA (compact/minimal/full)
- `src/components/AIAssistantChat.tsx` - Chat IA-Humano para formulários
- `src/components/AIClassificationDialog.tsx` - Diálogo de classificação
- `src/pages/BankImport.tsx` - Importação com IA integrada e chat

### Edge Functions:
- `supabase/functions/ai-bank-transaction-processor/index.ts`
- `supabase/functions/_shared/gemini.ts`

---

## MIGRATIONS APLICADAS

| Arquivo | Descrição |
|---------|-----------|
| `20251129250000_complete_chart_of_accounts.sql` | Plano de contas completo |
| `20251129260000_register_sicredi_account.sql` | Conta Sicredi + saldo inicial |
| `20251129270000_opening_balance_entry.sql` | Lançamento de abertura 31/12/2024 |
| `20251129280000_ai_transaction_learning.sql` | Sistema de aprendizado IA |
| `20251130000000_cleanup_duplicate_bank_accounts.sql` | Desativa conta Sicredi duplicada |
| `20251130010000_reset_january_transactions.sql` | Limpa transações para reimportação |
| `20251130020000_partner_expense_accounts.sql` | Contas e centros de custo para sócios |
| `20251130030000_sergio_expense_categories.sql` | Categorias de despesas do sócio Sergio |
| `20251130040000_company_profile_employees.sql` | Perfil empresa, funcionários, terceiros, contratos |
| `20251130050000_inventory_purchasing_system.sql` | Sistema de estoque e compras |
| `20251130060000_labor_law_advisory_system.sql` | Sistema de consultoria trabalhista com IA |
| `20251130070000_payroll_esocial_system.sql` | Folha de pagamento com rubricas eSocial |
| `20251130080000_ai_governance_automation.sql` | Governança IA, reuniões, apresentações |
| `20251130090000_business_development_solutions.sql` | Soluções de negócios, vendas, indicações |
| `20251130100000_marketing_employee_incentives.sql` | Incentivos, comissões, PLR |
| `20251130110000_video_content_generation.sql` | Geração de conteúdo IA |
| `20251130120000_business_maturity_analysis.sql` | Análise de maturidade empresarial |
| `20251130130000_openai_sora2_video_generation.sql` | Integração OpenAI Sora 2 para vídeos |
| `20251130140000_continuous_improvement_system.sql` | Sistema de evolução contínua via funcionários |

---

## SISTEMA DE ESTOQUE E COMPRAS

### Tabelas (Migration `20251130050000`):

| Tabela | Descrição |
|--------|-----------|
| `office_products` | Produtos do escritório (36 cadastrados) |
| `product_purchases` | Histórico de compras com preços |
| `product_consumption` | Registro de consumo/baixa |
| `purchase_lists` | Listas de compras (orçamento) |
| `purchase_list_items` | Itens das listas |
| `suppliers` | Fornecedores cadastrados |

### Produtos Cadastrados:

**LIMPEZA (15 produtos):**
- Detergente, Desinfetante, Água Sanitária, Sabão em Pó
- Limpa Vidro, Multiuso, Álcool 70%, Lustra Móveis
- Esponjas, Panos de Chão, Sacos de Lixo, Luvas

**HIGIENE (3 produtos):**
- Papel Higiênico, Papel Toalha, Sabonete Líquido

**ALIMENTAÇÃO (10 produtos):**
- Café Melitta, Açúcar, Adoçante, Leite em Pó
- Bolachas (Cream Cracker, Oreo)
- Filtro de Café, Copos Descartáveis, Água Mineral

**ESCRITÓRIO (8 produtos):**
- Papel A4, Canetas, Lápis, Borracha
- Grampeador, Grampos, Clips

### Fornecedores:
- **Atacadão** - Limpeza, Alimentação (melhor preço)
- **Bretas** - Compras de emergência
- **Kalunga** - Material de escritório
- **Disk Água Indaiá** - Galões de água

### Funcionalidades:

1. **Gerar Lista Automática:**
```sql
SELECT generate_shopping_list('Lilian');
```

2. **Ver Estoque Baixo:**
```sql
SELECT * FROM vw_low_stock_products;
```

3. **Histórico de Preços:**
```sql
SELECT * FROM vw_product_price_history;
```

### Responsável: Lilian (Faxineira)
- Registra consumo de produtos
- Informa quando estoque está baixo
- Recebe lista de compras para cotação

---

## SISTEMA DE CONSULTORIA TRABALHISTA COM IA

### Agentes Especializados:

**Dr. Advocato (Advogado Trabalhista IA)**
- Especialista em CLT e jurisprudência TST/TRT
- Analisa riscos trabalhistas e sugere soluções jurídicas
- Consulta decisões de tribunais para embasar recomendações

**Sr. Empresário (Estrategista Empresarial)**
- Especialista em estruturação societária e holdings
- Encontra soluções criativas dentro da lei
- Sugere MEI, ME, integração societária, terceirização

### Tabelas (Migration `20251130060000`):

| Tabela | Descrição |
|--------|-----------|
| `ai_agents` | Agentes IA do sistema (6 agentes) |
| `labor_legislation` | Base de legislação trabalhista (CLT, Súmulas) |
| `labor_jurisprudence` | Decisões judiciais TST/TRT |
| `labor_solution_strategies` | Estratégias de solução (6 modelos) |
| `risk_solution_mapping` | Mapeamento risco → soluções |
| `ai_labor_consultations` | Consultas e recomendações da IA |

### Estratégias de Solução Disponíveis:

| Código | Nome | Eficácia | Complexidade |
|--------|------|----------|--------------|
| `MEI_FORMALIZATION` | Formalização como MEI | 9/10 | Baixa |
| `CLT_REGULARIZATION` | Regularização via CLT | 10/10 | Baixa |
| `PARTNER_INTEGRATION` | Integração ao Quadro Societário | 7/10 | Alta |
| `SERVICE_COMPANY` | Criação de Empresa Prestadora | 8/10 | Média |
| `DIARISTA_CONTRACT` | Contrato de Diarista | 9/10 | Baixa |
| `STRUCTURED_OUTSOURCING` | Terceirização Estruturada | 7/10 | Média |

### Jurisprudência Cadastrada:

- TST: MEI sem vínculo reconhecido (autonomia)
- TRT-3: Pagamento por fora = fraude (RISCO!)
- TST: Terceirização lícita (atividade-fim)
- TRT-3: Sócio minoritário com vínculo (subordinação)
- TST: Diarista até 2 dias/semana (OK)

### Consultas Automáticas Geradas:

| Funcionário | Risco | Soluções Sugeridas |
|-------------|-------|-------------------|
| Rose | CRÍTICO (67% por fora) | CLT integral ou integração societária 5-10% |
| Josimar | ALTO (por fora) | Integração como sócio 10-15% (contador gerente) |
| Sr. Daniel | MÉDIO (terceirização) | Manter MEI + contrato + NF regular |
| Lilian | BAIXO (diarista) | Máximo 2 dias/semana + recibo diária |

### Funções SQL:

```sql
-- Buscar soluções para uma pessoa
SELECT * FROM get_labor_solutions_for_person('employee', 'uuid-do-funcionario');

-- Buscar jurisprudência por palavras-chave
SELECT * FROM search_jurisprudence(ARRAY['MEI', 'vínculo'], 'favoravel_empresa');
```

### Views:

- `vw_labor_risks_with_solutions` - Riscos com soluções sugeridas
- `vw_person_labor_analysis` - Análise completa por pessoa
- `vw_jurisprudence_by_risk` - Jurisprudência por tipo de risco
- `vw_ai_labor_context` - Contexto completo para IA

---

## SISTEMA DE FOLHA DE PAGAMENTO (eSocial)

### Conceito:

Ao cadastrar um funcionário, já especifica:
- Quanto recebe **dentro da carteira** (oficial)
- Quanto recebe **por fora** (não registrado)
- A IA já sabe e gera a folha automaticamente
- Humano compara com sistema de folha oficial

### Tabelas (Migration `20251130070000`):

| Tabela | Descrição |
|--------|-----------|
| `esocial_rubricas` | Códigos de eventos eSocial (32 rubricas) |
| `payroll` | Folha de pagamento mensal |
| `payroll_events` | Eventos/lançamentos da folha |
| `tabela_inss` | Alíquotas INSS progressivo 2024 |
| `tabela_irrf` | Alíquotas IRRF 2024 |
| `parametros_folha` | Parâmetros (salário mínimo, teto, etc.) |

### Rubricas eSocial:

**Proventos Oficiais (código 1xxx):**
- 1000 Salário Base
- 1010 Adicional Insalubridade/Periculosidade
- 1020/1021 Hora Extra 50%/100%
- 1040 Gratificação de Função
- 1050/1051 Férias + 1/3 Constitucional
- 1080/1090 Vale Transporte/Alimentação

**Descontos Oficiais (código 2xxx):**
- 2000 INSS
- 2001 IRRF
- 2010/2011 Desc. Vale Transporte/Alimentação
- 2040 Adiantamento Salarial
- 2050 Empréstimo Consignado
- 2070 Plano de Saúde

**Pagamentos "Por Fora" (código 9xxx):**
- 9000 Complemento Salarial (por fora)
- 9001 Bonificação Extra (por fora)
- 9002 Ajuda de Custo Extra (por fora)

### Campos Adicionados em Employees:

```sql
salary_details JSONB -- Detalhamento: base_oficial, complemento_por_fora, justificativa
payment_day INTEGER -- Dia do pagamento (ex: 5)
payment_method TEXT -- pix, transferencia, dinheiro
contract_type TEXT -- clt, temporario, experiencia, diarista
workload_hours INTEGER -- Carga horária mensal
has_insalubrity BOOLEAN
has_periculosity BOOLEAN
transport_voucher_value DECIMAL
meal_voucher_value DECIMAL
health_plan_value DECIMAL
```

### Funções de Cálculo:

```sql
-- Calcular INSS progressivo
SELECT calcular_inss(3500.00); -- Retorna ~R$ 324,57

-- Calcular IRRF
SELECT calcular_irrf(3175.43, 2); -- Base - INSS, 2 dependentes

-- Gerar folha de um funcionário
SELECT gerar_folha_funcionario('uuid-do-funcionario', '2024-11-01');

-- Gerar folha mensal completa
SELECT * FROM gerar_folha_mensal('2024-11-01');
```

### Views da Folha:

- `vw_payroll_summary` - Resumo com alertas de valores "por fora"
- `vw_payroll_events_detailed` - Eventos detalhados por rubrica
- `vw_salary_comparison` - Comparativo carteira vs por fora

### Trigger Automático:

Ao cadastrar funcionário CLT, gera folha do mês automaticamente!

---

## CADASTRO DA EMPRESA E FUNCIONÁRIOS

### Tabelas Criadas (Migration `20251130040000`):

| Tabela | Descrição |
|--------|-----------|
| `company_profile` | Perfil da empresa (CNPJ, endereço, etc.) |
| `company_partners` | Sócios da empresa |
| `partner_family` | Familiares dos sócios (para classificar despesas) |
| `employees` | Funcionários CLT e autônomos |
| `service_providers` | Prestadores de serviço (terceiros/MEI) |
| `provider_invoices` | Notas fiscais e recibos de prestadores |
| `contract_templates` | Modelos de contrato |
| `labor_alerts` | Alertas trabalhistas |
| `partner_properties` | Imóveis dos sócios |
| `partner_vehicles` | Veículos dos sócios |
| `office_recurring_expenses` | Despesas recorrentes (café, bolacha, etc.) |

### Funcionários da Ampla:

| Nome | Área | Tipo | Risco |
|------|------|------|-------|
| Rose | DP | CLT (misto) | ⚠️ ALTO - Pagamento por fora |
| Josimar | Contábil | CLT (misto) | ⚠️ ALTO - Pagamento por fora |
| Lilian | Administrativo | Autônomo | ⚠️ MÉDIO - Verificar frequência |

**Lilian (Faxineira):**
- Responsável pela limpeza do escritório
- Controla uso de produtos de limpeza
- Informa quando precisa comprar materiais

### Prestadores de Serviço (Terceiros):

| Nome | Área | Tipo | Status |
|------|------|------|--------|
| Sr. Daniel | Fiscal | MEI | ✅ BAIXO - Modelo ideal |

**Sr. Daniel é o modelo ideal de terceirização:**
- Tem empresa própria (MEI)
- Contrata e gerencia seus ajudantes
- Trabalha por produção
- Autonomia total sobre horários
- **Pendente:** Contrato formal + Exigir NF mensal

### Views de Compliance:

- `vw_labor_risk_summary` - Resumo de riscos trabalhistas
- `vw_provider_compliance` - Status de compliance dos terceiros
- `vw_all_labor_alerts` - Todos os alertas consolidados
- `vw_ai_company_context` - Contexto para a IA classificar

### Modelos de Contrato Disponíveis:

1. **Contrato de Prestação de Serviços - MEI**
2. **Contrato de Prestação de Serviços - Autônomo**
3. **Recibo de Pagamento a Autônomo (RPA)**

---

## SISTEMA DE GOVERNANÇA IA

### Princípio Fundamental:
**NADA SEM AGENTE** - Cada tela/formulário tem um agente IA responsável. Nenhuma decisão é tomada sem orientação de profissionais renomados.

### Mapeamento de Agentes por Tela:

| Tela | Agente Principal | Função |
|------|------------------|--------|
| `/dashboard` | Dra. Helena | Monitora KPIs e alerta desvios |
| `/executive` | Prof. Milton | Análise financeira executiva |
| `/cash-flow` | Prof. Milton | Projeções de liquidez |
| `/bank-import` | Atlas | Classifica transações (aprende) |
| `/bank-reconciliation` | Dr. Cícero | Concilia extrato x contabilidade |
| `/billing` | Dra. Helena | Gerencia faturamento |
| `/expenses` | Prof. Milton | Controla despesas |
| `/employees` | Dr. Advocato | Monitora riscos trabalhistas |
| `/payroll` | Dr. Cícero | Gera folha e lançamentos |
| `/providers` | Dr. Advocato + Sr. Empresário | Avalia riscos e estruturas |
| `/inventory` | Dra. Helena | Controla estoque |
| `/purchases` | Prof. Milton | Aprova orçamentos |
| `/settings` | Dra. Helena | Coordena configurações |
| `/meetings` | Dra. Helena | Organiza reuniões |

### Automações Implementadas:

**1. Folha → Lançamentos Contábeis:**
```sql
-- Ao fechar folha, gera automaticamente:
D - 4.1.1.01 Salários      C - 2.1.3.01 Salários a Pagar
D - 4.1.2.01 INSS Patronal C - 2.1.3.02 INSS a Recolher
D - 4.1.2.02 FGTS          C - 2.1.3.03 FGTS a Recolher
D - 4.1.3.01 Prov. Férias  C - 2.1.4.01 Férias a Pagar
D - 4.1.3.02 Prov. 13º     C - 2.1.4.02 13º a Pagar
```

**2. Compras Aprovadas → Estoque:**
```sql
-- Prof. Milton aprova orçamento
SELECT approve_purchase_list(list_id, 'milton', 'Preços compatíveis');

-- Dra. Helena registra entrada no estoque
SELECT register_purchase_and_stock(list_id, 'NF123', 450.00);

-- Lilian registra consumo
SELECT register_consumption(product_id, 2, 'Lilian', 'Uso semanal');
```

**3. Thresholds de Aprovação:**
- Importação bancária > R$ 5.000: precisa humano
- Despesas > R$ 2.000: precisa humano
- Compras > R$ 500: precisa humano
- Faturamento > R$ 10.000: precisa humano

### Sistema de Reuniões:

**Tipos de Reunião:**
- **Semanal**: Operacional (Sergio + Josimar + Rose)
- **Mensal**: Resultados (Sergio + Filhos: Nayara, Victor Hugo, Sergio Augusto)
- **Trimestral**: Estratégica (Sócios + Consultores)
- **Extraordinária**: Quando necessário

**Participantes Padrão:**
| Tipo | Participantes |
|------|--------------|
| Mensal | Sergio (obrigatório), Nayara, Victor Hugo, Sergio Augusto |
| Semanal | Sergio, Josimar (obrigatório), Rose |

**Fluxo da Reunião:**
1. Dra. Helena gera pauta automaticamente baseada nos dados
2. Sistema identifica alertas (trabalhistas, estoque, financeiro)
3. IA gera apresentação em slides para TV
4. Cada agente apresenta sua área
5. Decisões são registradas
6. Ações são atribuídas com responsáveis e prazos

**Funções SQL:**
```sql
-- Agendar reunião mensal
SELECT schedule_monthly_meeting();

-- Gerar pauta baseada nos dados
SELECT generate_meeting_agenda(meeting_id);

-- Gerar apresentação para TV
SELECT generate_meeting_presentation(meeting_id);
```

### Apresentações para TV:

A IA gera slides automaticamente com:
- Capa com título e data
- Pauta da reunião
- KPIs financeiros (receita, despesas, lucro, inadimplência)
- Alertas urgentes (riscos trabalhistas, compliance)
- Gráficos de desempenho
- Próximos passos e responsáveis

**Configuração de exibição:**
- Modo: fullscreen (TV)
- Avanço automático: Sim
- Duração por slide: 30 segundos

### Tabelas (Migration `20251130080000`):

| Tabela | Descrição |
|--------|-----------|
| `ai_page_agents` | Mapeamento agente → tela |
| `payroll_journal_entries` | Lançamentos da folha |
| `inventory_movements` | Movimentação de estoque |
| `ai_meetings` | Reuniões agendadas |
| `meeting_default_participants` | Participantes padrão |
| `ai_presentations` | Apresentações geradas |

### View de Monitoramento:

```sql
SELECT * FROM vw_agent_dashboard;
-- Mostra cada agente, suas páginas e tarefas pendentes
```

---

## SISTEMA DE DESENVOLVIMENTO DE NEGÓCIOS

### Princípio:
**Não basta identificar problemas - a IA propõe SOLUÇÕES PRÁTICAS**

Quando há rombo de R$ 1.000, o Sr. Vendedor não só alerta - ele apresenta estratégias concretas para recuperar.

### Novo Agente: Sr. Vendedor
- Especialista em vendas consultivas de serviços contábeis
- Identifica oportunidades, treina equipe, propõe estratégias
- Quando há déficit, apresenta soluções com scripts prontos

### Estratégias de Solução para Déficit:

| Código | Estratégia | Impacto Esperado | Complexidade |
|--------|------------|------------------|--------------|
| `SELL_MORE_SERVICES` | Venda de Serviços Adicionais | 15% | Média |
| `REFERRAL_PROGRAM` | Programa de Indicações | 25% | Baixa |
| `PROSPECT_CLIENT_PARTNERS` | Prospecção via Quadro Societário | 20% | Média |
| `CLIENT_RETENTION` | Retenção de Clientes em Risco | 10% | Baixa |
| `INCREASE_FEES` | Reajuste de Honorários | 12% | Alta |

### Programa de Indicações:

**Política para Clientes:**
- Indicador recebe: 10% desconto por 3 meses
- Indicado recebe: 10% desconto por 3 meses
- Máximo: R$ 500,00

**Política para Funcionários:**
- Comissão: 15% do primeiro honorário
- Máximo: R$ 1.000,00

### Prospecção via Quadro Societário:

```sql
-- Identificar sócios de clientes que têm outras empresas não atendidas
-- A IA consulta CNPJA, identifica CPFs, busca outras empresas
-- Gera lista de prospects com potencial

-- Ver oportunidades
SELECT * FROM vw_growth_opportunities;
```

**Script de Abordagem:**
> "[CLIENTE], vi que você também é sócio da [OUTRA EMPRESA]. Quem cuida da contabilidade de lá? Sabia que podemos oferecer condições especiais por você já ser nosso cliente?"

### Módulos de Treinamento:

| Módulo | Conteúdo | Duração |
|--------|----------|---------|
| Abordagem Inicial | Como abordar novos clientes | 30 min |
| Pedir Indicações | Momento e forma certa | 20 min |
| Retenção de Clientes | Identificar sinais e agir | 25 min |
| Serviços Adicionais | Upsell e cross-sell | 30 min |

### Função para Propor Soluções:

```sql
-- Quando detectar déficit de R$ 5.000:
SELECT propose_gap_solutions('deficit', 5000.00);

-- Retorna JSON com:
-- - Lista de soluções priorizadas
-- - Valor esperado de recuperação de cada uma
-- - Scripts de abordagem
-- - Passos de implementação
-- - Recomendação do Sr. Vendedor
```

### Tabelas (Migration `20251130090000`):

| Tabela | Descrição |
|--------|-----------|
| `financial_gap_solutions` | Gaps identificados e soluções propostas |
| `solution_templates` | Templates de soluções por tipo de problema |
| `client_partners_prospects` | Prospects via quadro societário |
| `referral_program` | Programa de indicações |
| `referral_policy` | Políticas de recompensa |
| `sales_training_modules` | Módulos de treinamento com scripts |
| `sales_training_records` | Registro de treinamentos realizados |

---

## SISTEMA DE INCENTIVOS E PLR

### Novo Agente: Sra. Marketing
- Gestora de Marketing, Incentivos e Campanhas
- Gerencia programas de comissão e PLR
- Coordena conteúdo para TVs e redes sociais

### Políticas de Incentivos para Funcionários:

| Tipo | Descrição | Valor |
|------|-----------|-------|
| `referral_bonus` | Comissão por indicação de cliente | 15% do 1º honorário (máx R$ 1.000) |
| `sales_commission` | Comissão por vendas | 5% do valor |
| `sales_bonus` | Bônus por meta de vendas | R$ 500 por meta |
| `performance_bonus` | Bônus por desempenho | 10% sobre avaliação |
| `retention_bonus` | Bônus por retenção de clientes | 3% do honorário anual |

### Onde Funcionários Podem Vender:
- Padaria, Açougue, Academia
- Salão de beleza, Supermercado
- Feirantes, Lanchonetes
- **Qualquer MEI ou pequeno negócio do dia a dia!**

### Sistema de PLR (Participação nos Lucros):

**Conceito CRÍTICO:** PLR só pode ser implementado se a empresa tem:
- Contabilidade em dia
- Lucro positivo nos últimos 6 meses
- Balancete estruturado
- Maturidade empresarial adequada

**Critérios de Distribuição:**

| Critério | Peso |
|----------|------|
| Tempo de casa | 30% |
| Metas individuais | 25% |
| Metas da equipe | 20% |
| Indicações de clientes | 15% |
| Avaliação de desempenho | 10% |

**Funções SQL:**
```sql
-- Calcular comissão de um funcionário
SELECT calculate_employee_commission('uuid-funcionario', '2024-11-01', '2024-11-30');

-- Distribuir PLR
SELECT distribute_plr('uuid-programa');
```

### Tabelas (Migration `20251130100000`):

| Tabela | Descrição |
|--------|-----------|
| `employee_incentive_policies` | Políticas de incentivo |
| `employee_sales` | Vendas e indicações dos funcionários |
| `marketing_videos` | Vídeos de treinamento/marketing |
| `tv_playlist` | Playlist para cada TV do escritório |
| `plr_programs` | Programas de PLR |
| `plr_criteria` | Critérios de cada programa |
| `plr_employee_share` | Distribuição por funcionário |

---

## SISTEMA DE ANÁLISE DE MATURIDADE EMPRESARIAL

### Princípio Fundamental:
**OS AGENTES ESTUDAM ANTES DE PROPOR**

Não adianta propor PLR se a empresa está com prejuízo. Não adianta criar programa de incentivos se não tem contabilidade estruturada.

### Níveis de Maturidade:

| Nível | Score | Descrição |
|-------|-------|-----------|
| `critical` | 0-20 | Empresa em crise, precisa de intervenção urgente |
| `developing` | 21-40 | Em desenvolvimento, foco em organização básica |
| `structured` | 41-60 | Estruturada, pode começar a crescer |
| `mature` | 61-80 | Madura, pode implementar programas avançados |
| `excellent` | 81-100 | Excelência, benchmark para outras |

### Pré-requisitos por Programa:

| Programa | Nível Mínimo | Requisitos |
|----------|--------------|------------|
| PLR | 70+ (mature) | Lucro positivo, balancete em dia, 6+ meses dados |
| Incentivos Vendas | 50+ (structured) | Margem positiva, fluxo de caixa OK |
| Programa Indicações | 40+ (developing) | Básico funcionando |
| Treinamentos | 30+ | Equipe estável |

### Função de Análise:

```sql
-- Calcular maturidade da empresa
SELECT calculate_business_maturity('2024-11');

-- Retorna:
{
  "maturity_score": 65,
  "maturity_level": "mature",
  "can_implement_plr": true,
  "can_implement_incentives": true,
  "can_implement_referrals": true,
  "dimensions": {
    "accounting": {"score": 70, "status": "healthy"},
    "financial": {"score": 60, "status": "attention"},
    "compliance": {"score": 75, "status": "healthy"},
    "structure": {"score": 55, "status": "attention"}
  },
  "recommendations": [
    "Aumentar margem operacional para 25%+",
    "Regularizar obrigações pendentes"
  ]
}

-- Verificar se pode implementar programa específico
SELECT can_implement_program('plr');
```

### Tabelas (Migration `20251130120000`):

| Tabela | Descrição |
|--------|-----------|
| `business_maturity_analysis` | Histórico de análises |
| `program_prerequisites` | Requisitos por programa |

---

## SISTEMA DE GERAÇÃO DE VÍDEOS COM SORA 2

### APIs Disponíveis:

| Provedor | Modelos | Capacidade |
|----------|---------|------------|
| **OpenAI** | GPT-5.1, GPT-4.1, **Sora 2** | Texto, Imagens, **Vídeos**, TTS |
| **Anthropic** | Claude Opus 4.5, Sonnet 4.5 | Texto, Análise |
| **Google** | Gemini 2.5 Pro/Flash | Texto, Imagens |

### OpenAI Sora 2:
- **Geração de vídeos** de alta qualidade
- **Áudio sincronizado** automaticamente
- Duração: 5-60 segundos
- Resolução: até 4K
- Estilos: Professional, Cinematic, Animated

### Templates de Vídeo Prontos:

| Template | Duração | Uso |
|----------|---------|-----|
| `VIDEO_INDICACAO` | 30s | Motivar funcionários a indicar |
| `VIDEO_TREINAMENTO_VENDAS` | 2 min | Ensinar como pedir indicações |
| `VIDEO_INSTITUCIONAL` | 60s | Apresentar Ampla para clientes |
| `VIDEO_DICA_RAPIDA` | 15s | Reels/TikTok com dicas fiscais |
| `VIDEO_PLR` | 45s | Explicar programa de PLR |

### Branding Ampla:

```json
{
  "primary_color": "#1e3a5f",
  "secondary_color": "#4a90d9",
  "accent_color": "#f5a623",
  "font": "Montserrat",
  "include_logo": true,
  "intro_duration": 3,
  "outro_duration": 3
}
```

### Playlist por TV:

| TV | Conteúdo |
|----|----------|
| Recepção | Institucional, Dicas para clientes |
| DP | Programa de indicações, Treinamentos |
| Fiscal | Dicas fiscais, Atualizações legais |
| RH | PLR, Incentivos, Treinamentos |
| Diretoria | Resultados, KPIs, Estratégia |

### Funções SQL:

```sql
-- Gerar vídeo com Sora 2
SELECT generate_sora_video(
    'VIDEO_INDICACAO',
    jsonb_build_object(
        'FUNCIONARIO_DESTAQUE', 'Rose Silva',
        'VALOR_GANHO', '800',
        'META_MES', '5 indicações'
    ),
    30,      -- duração em segundos
    '16:9',  -- aspect ratio
    1        -- prioridade (1=urgente)
);

-- Gerar narração TTS para vídeo
SELECT generate_video_narration(
    'project-uuid',
    'Olá equipe Ampla! Você sabia que pode ganhar até R$ 500 por cada cliente que indicar?',
    'nova'   -- voz OpenAI
);

-- Ver fila de geração
SELECT * FROM vw_sora_queue_status;

-- Ver vídeos prontos
SELECT * FROM vw_sora_videos_ready;
```

### Tabelas (Migration `20251130130000`):

| Tabela | Descrição |
|--------|-----------|
| `sora_video_projects` | Projetos de vídeo |
| `sora_video_templates` | Templates reutilizáveis |
| `sora_generation_queue` | Fila de processamento |
| `tv_video_playlist` | Playlist por TV |
| `video_branding_config` | Configuração visual |

---

## SISTEMA DE EVOLUÇÃO CONTÍNUA (Lovable.dev Interno)

### Conceito:
**Funcionários solicitam melhorias → Agentes IA analisam → Sistema evolui**

Como um Lovable.dev interno onde qualquer funcionário pode propor melhorias e os agentes IA orientam a implementação.

### Fluxo:

```
1. Funcionário identifica necessidade
   ↓
2. Registra solicitação (request_improvement)
   ↓
3. IA analisa automaticamente
   - Identifica agente responsável
   - Calcula complexidade
   - Busca templates similares
   - Gera perguntas de refinamento
   ↓
4. Gerente aprova/rejeita
   ↓
5. IA gera especificação técnica
   ↓
6. Implementação (pode ser automática para templates)
   ↓
7. Deploy e feedback do usuário
```

### Como Solicitar Melhoria:

```sql
-- Funcionário do financeiro quer vincular empresas:
SELECT request_improvement(
    'Rose',                    -- quem solicitou
    'financeiro',              -- departamento
    'Vincular empresas como grupo econômico',  -- título
    'Preciso vincular a empresa do João com a do Pedro porque são do mesmo grupo familiar',
    'Hoje gero relatórios separados e somo manualmente',  -- problema atual
    'Economizar tempo e dar desconto por volume',         -- benefício esperado
    'João tem padaria, Pedro tem açougue, mesma família'  -- exemplo concreto
);
```

### Templates Disponíveis:

| Template | Descrição | Tempo Estimado |
|----------|-----------|----------------|
| `GRUPO_ECONOMICO` | Vincular múltiplas empresas | 1 dia |
| `RELATORIO_PERSONALIZADO` | Criar relatório customizado | 1 hora |
| `AUTOMACAO_ROTINA` | Automatizar rotina manual | 1 semana |
| `INTEGRACAO_EXTERNA` | Conectar com API externa | 1 semana |
| `ALERTA_NOTIFICACAO` | Sistema de alertas | 1 dia |
| `DASHBOARD_INDICADOR` | Novo KPI no dashboard | 1 hora |

### Exemplo Real: Grupos Econômicos

**O sistema já implementa** a funcionalidade de grupos econômicos como exemplo:

```sql
-- Criar grupo econômico
SELECT create_economic_group(
    'Grupo Família Silva',
    'Padaria do João Ltda',
    '12.345.678/0001-90',
    '[
        {"name": "Açougue do Pedro ME", "cnpj": "98.765.432/0001-10", "relationship": "affiliate"},
        {"name": "Mercadinho Silva", "cnpj": "11.222.333/0001-44", "relationship": "affiliate"}
    ]'::jsonb
);

-- Ver grupos
SELECT * FROM vw_economic_groups_summary;
```

### Métricas de Evolução:

```sql
SELECT * FROM vw_evolution_metrics;
-- pendentes, em_analise, aprovadas, implementadas, satisfacao_media
```

### Tabelas (Migration `20251130140000`):

| Tabela | Descrição |
|--------|-----------|
| `feature_requests` | Solicitações de melhoria |
| `feature_analysis_history` | Análises da IA |
| `feature_templates` | Templates de funcionalidades |
| `economic_groups` | Grupos econômicos |
| `economic_group_members` | Empresas de cada grupo |

---

## PRÓXIMAS TAREFAS

### Concluído:
1. ~~Sistema de diálogo IA-Humano~~ ✅
2. ~~Reorganização do menu~~ ✅
3. ~~Sistema de Adiantamentos a Sócios~~ ✅
4. ~~Equipe de Agentes IA com identidade~~ ✅
5. ~~AITeamBadge no sidebar~~ ✅
6. ~~AIAssistantChat para formulários~~ ✅
7. ~~Cadastro de empresa, funcionários e terceiros~~ ✅
8. ~~Sistema de contratos e compliance~~ ✅
9. ~~Sistema de estoque e compras~~ ✅
10. ~~Lilian cadastrada como faxineira~~ ✅
11. ~~36 produtos cadastrados (limpeza, alimentação, escritório)~~ ✅
12. ~~Sistema de consultoria trabalhista com IA~~ ✅
13. ~~Dr. Advocato (Advogado Trabalhista IA)~~ ✅
14. ~~Sr. Empresário (Estrategista Empresarial)~~ ✅
15. ~~Base de jurisprudência trabalhista~~ ✅
16. ~~Estratégias de solução para riscos trabalhistas~~ ✅
17. ~~Sistema de folha de pagamento eSocial~~ ✅
18. ~~Rubricas eSocial (oficial + por fora)~~ ✅
19. ~~Tabelas INSS/IRRF progressivo 2024~~ ✅
20. ~~Cálculo automático de encargos~~ ✅
21. ~~Geração automática de folha ao cadastrar CLT~~ ✅
22. ~~Governança IA - Agente responsável por cada tela~~ ✅
23. ~~Sistema de reuniões periódicas com IA~~ ✅
24. ~~Gerador de slides/apresentações para TV~~ ✅
25. ~~Sistema de soluções de negócios (não só problemas)~~ ✅
26. ~~Sr. Vendedor (Consultor Comercial IA)~~ ✅
27. ~~Programa de indicações com scripts~~ ✅
28. ~~Sistema de incentivos para funcionários~~ ✅
29. ~~Sra. Marketing (Gestora de Marketing IA)~~ ✅
30. ~~Sistema de PLR (Participação nos Lucros)~~ ✅
31. ~~Sistema de análise de maturidade empresarial~~ ✅
32. ~~Integração OpenAI Sora 2 para geração de vídeos~~ ✅
33. ~~Templates de vídeo (indicação, treinamento, institucional, PLR)~~ ✅
34. ~~Playlist por TV (recepção, DP, fiscal, RH, diretoria)~~ ✅
35. ~~Branding Ampla configurado~~ ✅
36. ~~Secret OpenAI_API_KEY configurado no Supabase~~ ✅

### Concluído (Infraestrutura):
37. ~~Análise de segurança do frontend~~ ✅
38. ~~Configuração CI/CD GitHub Actions~~ ✅
39. ~~Script automático de configuração de secrets~~ ✅
40. ~~Documentação atualizada~~ ✅

### Concluído (Interfaces - Última Sessão Claude Code 30/11):
41. ~~Redesign completo da tela de Login (Auth.tsx)~~ ✅
42. ~~CRUD completo Folha de Pagamento (Payroll.tsx)~~ ✅
43. ~~CRUD completo Estoque/Compras (Inventory.tsx)~~ ✅ - Lilian pode cadastrar produtos/fornecedores
44. ~~CRUD completo Vídeos e TVs (VideoContent.tsx)~~ ✅ - Com aba IA e sugestões
45. ~~Logos SVG da Ampla criadas~~ ✅ - logo-ampla.svg e logo-ampla-white.svg

### Pendente (Interfaces - Prioridade Alta):
46. Criar tela para funcionário preencher entidades pendentes
47. Criar interface de Configurações com cadastros (Settings.tsx tem TODO)
48. Criar interface de Consultoria Trabalhista com Edge Function real (atual é mock)
49. Criar interface de Incentivos e PLR
50. Adicionar CRUD a Feature Requests (editar/excluir solicitações)

### Pendente (Dados):
51. Reimportar extrato Janeiro/2025 com 183 transações
52. Importar despesas do sócio Sergio (planilha Excel 2025)
53. Testar fluxo completo de classificação IA
54. Implementar conciliação bancária automática

### Pendente (Edge Functions):
55. Criar Edge Function para chamar Sora 2 e gerar vídeos
56. Criar Edge Function para análise de feature requests
