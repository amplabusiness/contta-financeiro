"""
Script para importar despesas de Janeiro/2025 da planilha para Supabase
Estrutura: Coluna A = Nome, Coluna C = Valor Janeiro/2025
"""
import pandas as pd
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv('VITE_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')  # Service role para bypass RLS
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# User ID para created_by (primeiro usuário do sistema)
DEFAULT_USER_ID = 'e3a168e5-4339-4c7c-a8e2-dd2ee84daae9'

# Ler planilha 2025 sem header
df = pd.read_excel('banco/Controle Despesas-1.xlsx', sheet_name='2025', header=None)

# Subtotais/seções para ignorar
SKIP_ROWS = [
    'TOTAL SAÍDAS', 'SERGIO CARNEIRO', 'TOTAL CUSTO AMPLA CONTABILIDADE',
    'CONTAS FIXAS', 'IMPOSTOS', 'CONTAS VARIÁVEIS', 'SERVIÇO TERCEIROS',
    'FOLHA PAGAMENTO', 'MATERIAL DE CONSUMO'
]

# Categorias e mapeamento
CATEGORIES = {
    'Água': 'UTILITIES', 'Energia': 'UTILITIES', 'Internet': 'UTILITIES', 'Gás': 'UTILITIES',
    'Telefone': 'UTILITIES', 'Celular': 'UTILITIES', 'Fixo': 'UTILITIES',
    'Nayara': 'PAYROLL', 'Sérgio Augusto': 'PAYROLL', 'Victor Hugo': 'PAYROLL', 
    'Babá': 'PAYROLL', 'Contábil': 'PAYROLL',
    'FGTS': 'TAXES', 'INSS': 'TAXES', 'IRRF': 'TAXES', 'IPTU': 'TAXES', 
    'ISS': 'TAXES', 'Simples Nacional': 'TAXES', 'Multas': 'TAXES',
    'Plano de Saúde': 'HEALTHCARE',
    'Condomínio': 'HOUSING', 'Obras': 'HOUSING',
    'IPVA': 'VEHICLE', 'Carretinha': 'VEHICLE',
    'Sistemas': 'SOFTWARE', 'Aplicativos': 'SOFTWARE',
    'Vale Alimentação': 'BENEFITS', 'Vale Transporte': 'BENEFITS',
    'Dep.': 'OUTSOURCING', 'Legalização': 'OUTSOURCING', 'Limpeza': 'OUTSOURCING',
    'Psicologia': 'OUTSOURCING', 'T.I': 'OUTSOURCING',
    'Comissão': 'COMMISSIONS',
    'Empréstimos': 'LOANS',
    'Eventuais': 'MISCELLANEOUS', 'Outros': 'MISCELLANEOUS',
    'Manutenção': 'MAINTENANCE',
    'Rescisão': 'PAYROLL',
    'Uniformes': 'SUPPLIES', 'Açucar': 'SUPPLIES',
    'Anuidade CRC': 'PROFESSIONAL',
    'Antônio': 'PERSONAL', 'Tharson': 'PERSONAL',
    'Outsider': 'SERVICES', 'Construtora': 'SERVICES',
}

def get_category(desc):
    for key, cat in CATEGORIES.items():
        if key in desc:
            return cat
    return 'MISCELLANEOUS'

# Processar linhas de despesas (linha 24 até ~95)
expenses = []
current_owner = 'SERGIO'
current_section = ''

for idx in range(23, 100):
    if idx >= len(df):
        break
    
    row = df.iloc[idx]
    desc = str(row[0]).strip() if pd.notna(row[0]) else ''
    jan_value = row[2] if pd.notna(row[2]) else 0
    
    if not desc or desc == 'nan' or desc == 'NaN':
        continue
    
    # Detectar proprietário
    if 'SERGIO CARNEIRO' in desc.upper():
        current_owner = 'SERGIO'
        continue
    if 'AMPLA CONTABILIDADE' in desc.upper():
        current_owner = 'AMPLA'
        continue
    
    # Detectar seções (guardar mas não importar)
    if desc in ['CONTAS FIXAS', 'IMPOSTOS', 'CONTAS VARIÁVEIS', 'SERVIÇO TERCEIROS', 'FOLHA PAGAMENTO', 'MATERIAL DE CONSUMO']:
        current_section = desc
        continue
    
    # Pular totais e subtotais
    if any(skip in desc.upper() for skip in ['TOTAL']):
        continue
    
    # Converter valor
    try:
        value = float(jan_value) if jan_value else 0
    except:
        continue
    
    if value <= 0:
        continue
    
    expenses.append({
        'description': desc,
        'amount': round(value, 2),
        'category': get_category(desc),
        'owner': current_owner,
        'section': current_section
    })

print(f'=== DESPESAS JANEIRO/2025 ENCONTRADAS: {len(expenses)} ===\n')
for exp in expenses:
    owner_str = f"[{exp['owner'][:6]}]"
    section_str = exp['section'][:12] if exp['section'] else '-'
    desc_str = exp['description'][:30]
    print(f"  {owner_str:8} {section_str:14} {desc_str:32} R$ {exp['amount']:>10,.2f}")

total = sum(e['amount'] for e in expenses)
print(f'\n  TOTAL DESPESAS: R$ {total:,.2f}')
print(f'\n--- Importando para Supabase... ---\n')

# Importar para accounts_payable
inserted = 0
errors = 0
for exp in expenses:
    try:
        notes = f"Importado de planilha. Proprietario: {exp['owner']}"
        if exp['section']:
            notes += f". Secao: {exp['section']}"
        
        record = {
            'description': f"{exp['description']} - Jan/2025",
            'supplier_name': exp['description'],
            'amount': exp['amount'],
            'due_date': '2025-01-10',
            'status': 'paid',
            'category': exp['category'],
            'notes': notes,
            'is_recurring': True,
            'created_by': DEFAULT_USER_ID,
        }
        supabase.table('accounts_payable').insert(record).execute()
        inserted += 1
        print(f"  [OK] {exp['description']}")
    except Exception as e:
        errors += 1
        print(f"  [ERRO] {exp['description']}: {e}")

print(f'\n=== IMPORTACAO CONCLUIDA ===')
print(f'  Inseridos: {inserted}/{len(expenses)}')
if errors > 0:
    print(f'  Erros: {errors}')
print(f'  Total importado: R$ {total:,.2f}')
