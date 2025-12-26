# 📋 GUIA: Integração de Folha de Pagamento no Employees.tsx

**Data:** 26 de Dezembro de 2025  
**Status:** Pronto para Implementação

---

## 🎯 Objetivo

Integrar o sistema de folha de pagamento com rastreamento automático de lançamentos contábeis no componente `Employees.tsx`.

---

## 📦 Arquivos Envolvidos

| Arquivo | Propósito |
|---------|----------|
| `src/pages/Employees.tsx` | Componente a ser atualizado |
| `src/hooks/usePayrollAccounting.ts` | Hook com lógica de lançamentos |
| `src/services/RastreamentoService.ts` | Sistema de rastreamento |
| `supabase/migrations/20251226_create_payroll_tables.sql` | Tabelas de banco de dados |

---

## 🔄 Fluxo de Integração

```
┌─────────────────────────────────────────────┐
│  1. Usuário acessa Employees.tsx           │
│     e clica em "Nova Folha"                 │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  2. Dialog/Modal abre com formulário        │
│     - Seleciona mês/ano                     │
│     - Insere dados de funcionários          │
│     - Calcula automaticamente INSS/IRRF     │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  3. Sistema valida dados                    │
│     - Verifica cálculos                     │
│     - Testa duplicatas                      │
│     - Gera código de rastreamento           │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  4. Cria registro em Payrolls               │
│     - Status: 'draft'                       │
│     - Reference code salvo                  │
│     - Detalhes salvos em Payroll_details    │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  5. Registra lançamentos contábeis           │
│     - Cria entrada em accounting_entries    │
│     - Cria linhas em accounting_entry_lines │
│     - Registra rastreamento                 │
└────────────┬────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────┐
│  6. Mostra confirmação                      │
│     - Código de rastreamento                │
│     - Totais provisados                     │
│     - Status da folha                       │
└─────────────────────────────────────────────┘
```

---

## 💻 Código de Integração

### Passo 1: Adicionar Imports

```typescript
// src/pages/Employees.tsx

import { usePayrollAccounting, FolhaPagamento } from '@/hooks/usePayrollAccounting';
import { obterHistoricoRastreamento } from '@/services/RastreamentoService';

// ... outros imports
```

### Passo 2: Adicionar Estados

```typescript
const Employees = () => {
  // ... estados existentes
  
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [newPayroll, setNewPayroll] = useState({
    mes: new Date().getMonth() + 1,
    ano: new Date().getFullYear(),
    funcionarios: [] as any[]
  });
  const [payrollLoading, setPayrollLoading] = useState(false);
  
  const { registrarFolhaProvisao } = usePayrollAccounting();
  
  // ... resto do componente
};
```

### Passo 3: Validação e Cálculo Automático

```typescript
const calcularFolha = useCallback((funcionarios: any[]) => {
  return funcionarios.map(emp => ({
    employeeId: emp.id,
    employeeName: emp.name,
    salarioBruto: emp.salary || 0,
    inssRetido: (emp.salary || 0) * 0.10,      // 10% INSS
    irrfRetido: (emp.salary || 0) * 0.05,      // 5% IRRF
    salarioLiquido: (emp.salary || 0) * 0.85   // Liquido = 85% do bruto
  }));
}, []);

const handleCalcularFolha = useCallback(() => {
  const detalhes = calcularFolha(employees.filter(e => e.selected));
  setNewPayroll({
    ...newPayroll,
    funcionarios: detalhes
  });
  
  toast.success(`${detalhes.length} funcionários calculados`);
}, [employees, newPayroll, calcularFolha]);
```

### Passo 4: Registrar Folha com Rastreamento

```typescript
const handleSalvarFolha = async () => {
  if (newPayroll.funcionarios.length === 0) {
    toast.error('Nenhum funcionário selecionado');
    return;
  }

  setPayrollLoading(true);
  
  try {
    // 1️⃣ Gerar dados da folha
    const folhaPagamento: FolhaPagamento = {
      mes: newPayroll.mes,
      ano: newPayroll.ano,
      dataFolha: new Date().toISOString().split('T')[0],
      funcionarios: newPayroll.funcionarios
    };

    // 2️⃣ Registrar provisão e lançamentos contábeis
    const result = await registrarFolhaProvisao(folhaPagamento);

    if (!result.success) {
      toast.error(`Erro: ${result.error}`);
      return;
    }

    // 3️⃣ Salvar folha em tabela payrolls
    const { data: payroll, error: payrollError } = await supabase
      .from('payrolls')
      .insert([
        {
          month: newPayroll.mes,
          year: newPayroll.ano,
          competence_date: new Date(newPayroll.ano, newPayroll.mes - 1, 1)
            .toISOString()
            .split('T')[0],
          due_date: new Date(newPayroll.ano, newPayroll.mes, 10)
            .toISOString()
            .split('T')[0],
          reference_code: `FOLD_${newPayroll.ano}${String(newPayroll.mes).padStart(2, '0')}`,
          status: 'provisioned',
          total_bruto: newPayroll.funcionarios.reduce((s, f) => s + f.salarioBruto, 0),
          total_inss: newPayroll.funcionarios.reduce((s, f) => s + f.inssRetido, 0),
          total_irrf: newPayroll.funcionarios.reduce((s, f) => s + f.irrfRetido, 0),
          total_liquido: newPayroll.funcionarios.reduce((s, f) => s + f.salarioLiquido, 0),
        }
      ])
      .select()
      .single();

    if (payrollError) {
      toast.error(`Erro ao salvar folha: ${payrollError.message}`);
      return;
    }

    // 4️⃣ Salvar detalhes por funcionário
    const { error: detalhesError } = await supabase
      .from('payroll_details')
      .insert(
        newPayroll.funcionarios.map(f => ({
          payroll_id: payroll.id,
          employee_id: f.employeeId,
          employee_name: f.employeeName,
          salary_bruto: f.salarioBruto,
          inss_retido: f.inssRetido,
          irrf_retido: f.irrfRetido,
          salary_liquido: f.salarioLiquido,
          inss_aliquota: 10.00,
          irrf_aliquota: 5.00,
          validation_status: 'valid'
        }))
      );

    if (detalhesError) {
      console.error('Erro ao salvar detalhes:', detalhesError);
      toast.warning('Folha salva mas com erro ao salvar detalhes');
      return;
    }

    // 5️⃣ Mostrar confirmação com código de rastreamento
    toast.success(
      `✅ Folha registrada com sucesso!\n` +
      `Código: ${result.codigoRastreamento || 'Gerado'}\n` +
      `Lançamento ID: ${result.entryId}`
    );

    // 6️⃣ Limpar formulário
    setPayrollDialogOpen(false);
    setNewPayroll({
      mes: new Date().getMonth() + 1,
      ano: new Date().getFullYear(),
      funcionarios: []
    });

    // 7️⃣ Recarregar dados
    loadEmployees();

  } catch (error) {
    console.error('Erro:', error);
    toast.error('Erro ao registrar folha de pagamento');
  } finally {
    setPayrollLoading(false);
  }
};
```

### Passo 5: Dialog para Nova Folha

```typescript
<Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
  <DialogTrigger asChild>
    <Button>
      <Plus className="w-4 h-4 mr-2" />
      Nova Folha de Pagamento
    </Button>
  </DialogTrigger>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>Nova Folha de Pagamento</DialogTitle>
      <DialogDescription>
        Registrar folha com lançamentos contábeis automáticos
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      {/* Seleção de Mês e Ano */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Mês</Label>
          <Select 
            value={String(newPayroll.mes)}
            onValueChange={(v) => setNewPayroll({...newPayroll, mes: parseInt(v)})}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({length: 12}, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {new Date(2025, i, 1).toLocaleString('pt-BR', {month: 'long'})}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Ano</Label>
          <Input
            type="number"
            value={newPayroll.ano}
            onChange={(e) => setNewPayroll({...newPayroll, ano: parseInt(e.target.value)})}
          />
        </div>
      </div>

      {/* Seleção de Funcionários */}
      <div>
        <Label>Funcionários</Label>
        <div className="border rounded-md p-3 space-y-2 max-h-48 overflow-y-auto">
          {employees.map(emp => (
            <div key={emp.id} className="flex items-center space-x-2">
              <Checkbox 
                checked={employees.find(e => e.id === emp.id && e.selected) ? true : false}
                onCheckedChange={(checked) => {
                  // Atualizar estado
                }}
              />
              <span>{emp.name}</span>
              <span className="ml-auto text-sm text-gray-500">
                R$ {(emp.salary || 0).toLocaleString('pt-BR')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo */}
      {newPayroll.funcionarios.length > 0 && (
        <div className="bg-gray-50 p-3 rounded-md space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Total Bruto:</span>
            <span className="font-semibold">
              R$ {newPayroll.funcionarios.reduce((s, f) => s + f.salarioBruto, 0).toLocaleString('pt-BR')}
            </span>
          </div>
          <div className="flex justify-between">
            <span>INSS (10%):</span>
            <span>R$ {newPayroll.funcionarios.reduce((s, f) => s + f.inssRetido, 0).toLocaleString('pt-BR')}</span>
          </div>
          <div className="flex justify-between">
            <span>IRRF (5%):</span>
            <span>R$ {newPayroll.funcionarios.reduce((s, f) => s + f.irrfRetido, 0).toLocaleString('pt-BR')}</span>
          </div>
          <div className="border-t pt-2 flex justify-between">
            <span className="font-semibold">Total Líquido:</span>
            <span className="font-semibold">
              R$ {newPayroll.funcionarios.reduce((s, f) => s + f.salarioLiquido, 0).toLocaleString('pt-BR')}
            </span>
          </div>
        </div>
      )}
    </div>

    <DialogFooter>
      <Button 
        variant="outline" 
        onClick={() => setPayrollDialogOpen(false)}
      >
        Cancelar
      </Button>
      <Button 
        onClick={handleCalcularFolha}
        variant="secondary"
      >
        Calcular
      </Button>
      <Button 
        onClick={handleSalvarFolha}
        disabled={payrollLoading || newPayroll.funcionarios.length === 0}
        loading={payrollLoading}
      >
        Registrar Folha
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

## 🧪 Testes a Realizar

### Teste 1: Criar Folha Simples
```
✓ Selecionar 1 funcionário
✓ Clicar "Calcular"
✓ Verificar cálculos (bruto, inss, irrf, líquido)
✓ Clicar "Registrar"
✓ Confirmar sucesso e código de rastreamento
✓ Verificar lançamentos contábeis no banco
```

### Teste 2: Validar Duplicata
```
✓ Tentar criar folha novamente com mesmos dados
✓ Sistema deve detectar duplicata
✓ Mostrar mensagem de erro apropriada
```

### Teste 3: Validar Integridade
```
✓ Inserir folha
✓ Usar serviço de rastreamento: validarIntegridade()
✓ Confirmar que hash bate
✓ Confirmar que não há duplicatas
```

### Teste 4: Histórico de Rastreamento
```
✓ Registrar folha
✓ Usar: obterHistoricoRastreamento(codigo)
✓ Confirmar que há registros
✓ Validar dados armazenados
```

---

## 📊 Estrutura de Dados Esperada

### Tabela: payrolls
```json
{
  "id": "uuid-xxx",
  "month": 12,
  "year": 2025,
  "status": "provisioned",
  "reference_code": "FOLD_202512_001_A7F2E9",
  "total_bruto": 5000.00,
  "total_inss": 500.00,
  "total_irrf": 250.00,
  "total_liquido": 4250.00
}
```

### Tabela: payroll_details
```json
{
  "payroll_id": "uuid-xxx",
  "employee_id": "uuid-yyy",
  "employee_name": "João Silva",
  "salary_bruto": 3000.00,
  "inss_retido": 300.00,
  "irrf_retido": 150.00,
  "salary_liquido": 2550.00
}
```

### Tabela: accounting_entry_tracking
```json
{
  "codigo_rastreamento": "FOLD_202512_001_A7F2E9",
  "tipo": "FOLD",
  "competencia_ano": 2025,
  "competencia_mes": 12,
  "sequencial": 1,
  "hash_validacao": "A7F2E9",
  "entry_id": "uuid-zzz",
  "foi_duplicado": false
}
```

---

## ✅ Checklist de Implementação

- [ ] Adicionar imports no Employees.tsx
- [ ] Adicionar estados para formulário
- [ ] Implementar função calcularFolha()
- [ ] Implementar função handleSalvarFolha()
- [ ] Criar dialog com formulário
- [ ] Testar com um funcionário
- [ ] Testar validação de duplicata
- [ ] Testar histórico de rastreamento
- [ ] Testes com múltiplos funcionários
- [ ] Validar DRE e Balanço
- [ ] Deploy em produção

---

## 🔗 Referências

- `src/hooks/usePayrollAccounting.ts` - Hook de folha
- `src/services/RastreamentoService.ts` - Sistema de rastreamento
- `supabase/migrations/20251226_create_payroll_tables.sql` - Schema do banco

---

**Próxima Etapa:** Implementar em Employees.tsx e testar com dados reais
