import json
import os
from datetime import datetime
from typing import Optional

def convert_date_format(date_str: str) -> str:
    """Converte DD/MM/YYYY para YYYY-MM-DD"""
    try:
        d, m, y = date_str.split('/')
        return f"{y}-{m}-{d}"
    except:
        return datetime.now().strftime('%Y-%m-%d')

# Carregar dados extraídos do PDF
json_file = r'C:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1\funcionarios_extraidos.json'

with open(json_file, 'r', encoding='utf-8') as f:
    employees_data = json.load(f)

# Remover duplicatas (manter o registro com valores completos)
unique_employees = {}
for emp in employees_data:
    key = f"{emp['codigo']}_{emp['nome']}"
    # Se o funcionário já existe e o novo tem mais dados, substitui
    if key not in unique_employees or emp['salario_base'] > unique_employees[key]['salario_base']:
        unique_employees[key] = emp

employees_clean = list(unique_employees.values())

print(f"Total de registros (com duplicatas): {len(employees_data)}")
print(f"Total de funcionários únicos: {len(employees_clean)}")
print("\nFuncionários a cadastrar:")
print("="*80)

for emp in employees_clean:
    print(f"\n✓ {emp['nome'].upper()}")
    print(f"  Código: {emp['codigo']}")
    print(f"  Cargo: {emp['cargo']}")
    print(f"  Salário Base: R$ {emp['salario_base']:,.2f}")
    print(f"  Data Admissão: {emp['data_admissao']}")
    print(f"  Departamento: {emp['departamento']}")

# Mapear departamentos para algo mais limpo
def map_department(dept_str: str) -> str:
    """Mapeia departamento longo para um código curto"""
    if 'CUSTOS OPERACIONAIS' in dept_str:
        return 'Operacional'
    elif 'DESPESAS ADMINISTRATIVAS' in dept_str:
        return 'Administrativo'
    elif 'FINANCEIRO' in dept_str:
        return 'Financeiro'
    elif 'CONTABIL' in dept_str or 'CONTÁBIL' in dept_str:
        return 'Contabil'
    else:
        return 'Administrativo'

# Preparar dados para inserção no Supabase
employees_to_insert = []

for emp in employees_clean:
    employee_insert = {
        "name": emp['nome'],
        "role": emp['cargo'],
        "department": map_department(emp['departamento']),
        "contract_type": emp['tipo_contrato'],
        "official_salary": emp['salario_base'],
        "unofficial_salary": 0,
        "hire_date": convert_date_format(emp['data_admissao']),
        "work_area": emp['cbo'],  # Usar CBO como work_area
        "is_active": emp['ativo']
    }
    employees_to_insert.append(employee_insert)

print("\n\n" + "="*80)
print("Dados preparados para inserção:")
print(json.dumps(employees_to_insert, indent=2, ensure_ascii=False))

# Atualizar dados com datas convertidas
for emp in employees_to_insert:
    emp_orig = next((e for e in employees_clean if e['nome'] == emp['name']), None)
    if emp_orig:
        emp['hire_date'] = convert_date_format(emp_orig['data_admissao'])

# Salvar como JSON para possível importação posterior
output_file = r'C:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1\funcionarios_para_inserir.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(employees_to_insert, f, indent=2, ensure_ascii=False)

print(f"\n✓ Arquivo de inserção salvo em: {output_file}")
print(f"✓ Total de {len(employees_to_insert)} funcionários prontos para cadastro!")
