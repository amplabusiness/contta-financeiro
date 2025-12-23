# 📋 Importação de Funcionários da Ampla - Guia de Uso

## Resumo

Foram extraídos e preparados os dados de 6 funcionários da Ampla a partir da folha de pagamento de janeiro de 2025. Os dados estão prontos para importação no sistema.

## 📊 Dados Extraídos

| Nome | Cargo | Departamento | Salário | Data Admissão |
|------|-------|--------------|---------|----------------|
| DEUZA RESENDE DE JESUS | Analista de Departamento Pessoal | Operacional | R$ 3.000,00 | 03/12/2024 |
| FABIANA MARIA DA SILVA MENDONCA | Baba | Administrativo | R$ 2.300,00 | 20/08/2024 |
| JOSIMAR DOS SANTOS MOTA | Coordenador Contábil | Operacional | R$ 3.762,00 | 27/07/2023 |
| RAIMUNDO PEREIRA MOREIRA | Caseiro | Administrativo | R$ 2.687,50 | 22/02/2024 |
| SERGIO AUGUSTO DE OLIVEIRA LEAO | Auxiliar Administrativo | Administrativo | R$ 2.950,00 | 03/10/2022 |
| THAYNARA CONCEICAO DE MELO | Analista Contábil | Operacional | R$ 3.727,75 | 02/05/2024 |

**Folha Total: R$ 18.426,25/mês**

---

## 🔄 Como Importar

### Opção 1: Via Dashboard (Recomendado)

1. Acesse: https://ampla.app.br
2. Vá para a seção "Folha de Pagamento"
3. Clique no botão **"Importar da Folha"** (canto superior direito)
4. Revise os dados a serem importados
5. Clique em **"Importar Funcionários"**
6. Sistema mostrará o resultado da importação

✅ **Vantagens:**
- Interface amigável
- Preview dos dados antes de importar
- Validação automática de duplicatas
- Feedback em tempo real

---

### Opção 2: SQL Direto (Supabase)

Se preferir executar diretamente no Supabase:

**Arquivo:** `importar_funcionarios_ampla.sql`

```sql
-- Importar os 6 funcionários da Ampla
INSERT INTO employees (name, role, department, contract_type, official_salary, unofficial_salary, hire_date, work_area, is_active)
VALUES 
  ('DEUZA RESENDE DE JESUS', 'ANALISTA DE DEPARTAMENTO PESSOAL', 'Operacional', 'CLT', 3000.00, 0, '2024-12-03', '413105', true),
  ('FABIANA MARIA DA SILVA MENDONCA', 'BABA', 'Administrativo', 'CLT', 2300.00, 0, '2024-08-20', '516205', true),
  ('JOSIMAR DOS SANTOS MOTA', 'COORDENADOR CONTABIL', 'Operacional', 'CLT', 3762.00, 0, '2023-07-27', '252210', true),
  ('RAIMUNDO PEREIRA MOREIRA', 'CASEIRO', 'Administrativo', 'CLT', 2687.50, 0, '2024-02-22', '514325', true),
  ('SERGIO AUGUSTO DE OLIVEIRA LEAO', 'AUXILIAR ADMINISTRATIVO', 'Administrativo', 'CLT', 2950.00, 0, '2022-10-03', '411010', true),
  ('THAYNARA CONCEICAO DE MELO', 'ANALISTA CONTABIL', 'Operacional', 'CLT', 3727.75, 0, '2024-05-02', '252210', true)
ON CONFLICT (name) DO NOTHING;
```

---

## 📁 Arquivos Gerados

### Scripts Python (Extração de Dados)
- **`extract_pdf.py`** - Extrai texto e tabelas do PDF da folha
- **`process_payroll_pdf.py`** - Processa o PDF e extrai dados estruturados
- **`prepare_employees_import.py`** - Limpa duplicatas e prepara JSON para importação

### Dados JSON
- **`funcionarios_extraidos.json`** - Dados brutos extraídos do PDF (7 registros com duplicata)
- **`funcionarios_para_inserir.json`** - Dados limpos prontos para importação (6 registros únicos)

### SQL
- **`importar_funcionarios_ampla.sql`** - Script SQL para importação direta

### TypeScript
- **`import-employees.ts`** - Script Node.js para importação via API Supabase

---

## ✅ Verificação Pós-Importação

Após importar, você pode verificar:

```sql
-- Ver todos os funcionários cadastrados
SELECT id, name, role, department, official_salary, hire_date, is_active 
FROM employees 
ORDER BY hire_date DESC;

-- Resumo de folha
SELECT 
  COUNT(*) as total_funcionarios,
  COUNT(CASE WHEN is_active THEN 1 END) as funcionarios_ativos,
  SUM(official_salary) as folha_total,
  AVG(official_salary) as salario_medio
FROM employees
WHERE is_active = true;
```

---

## 🔍 Processamento de Dados

O pipeline de extração trabalhou da seguinte forma:

1. **Extração do PDF** (pdfplumber)
   - Extrai tabelas da folha de janeiro/2025
   - Localiza: nome, cargo, salário, descontos, etc.

2. **Limpeza de Dados**
   - Remove registros duplicados
   - Converte datas (DD/MM/YYYY → YYYY-MM-DD)
   - Mapeia departamentos para códigos internos
   - Valida valores monetários

3. **Normalização**
   - Padroniza nomes de departamentos
   - Remove espaços extras
   - Valida estrutura de dados

4. **Saída Estruturada**
   - JSON com campos mapeados para tabela employees
   - Pronto para bulk insert

---

## 📝 Próximos Passos

Após importar os funcionários:

1. **Gerar Folha de Pagamento** para os meses subsequentes
2. **Configurar Rubricas** específicas da empresa
3. **Atualizar Salários** se houver alterações
4. **Configurar Descontos** (Vale transporte, Plano de saúde, etc.)
5. **Automatizar Cálculos** de INSS, IRRF, FGTS

---

## ⚠️ Notas Importantes

- ✅ Sistema evita duplicatas automaticamente
- ✅ Dados já foram validados e limpos
- ✅ Salários baseados em folha oficial
- ✅ Conformidade com dados históricos da Ampla

---

**Status:** ✅ Pronto para importação  
**Data de Extração:** Janeiro de 2025  
**Última Atualização:** 23 de Dezembro de 2025
