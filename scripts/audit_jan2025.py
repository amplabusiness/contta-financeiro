import requests
from collections import defaultdict

SUPABASE_URL = "https://xdtlhzysrpoinqtsglmr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

response = requests.get(
    f"{SUPABASE_URL}/rest/v1/accounting_entries?entry_date=gte.2025-01-01&entry_date=lte.2025-01-31&select=*,cost_centers(code,name)",
    headers=headers
)
entries = response.json()

print("=" * 120)
print("AUDITORIA CLT x FGTS - JANEIRO 2025")
print("=" * 120)

# Salarios CLT por departamento
clt_codes = ['1.1.1', '1.3.1', '1.11']  # DP.CLT, CONTABIL.CLT, LIMPEZA
clt_names = ['josimar', 'thaynara', 'lilian', 'deuza', 'erick', 'jessyca', 'luciana', 'luciane', 'thaniny', 'amanda', 'jordana', 'rosemeire']

print("\n[SALARIOS CLT ENCONTRADOS]")
print("-" * 120)

total_clt = 0
by_person = defaultdict(float)

for e in entries:
    cc = (e.get('cost_centers') or {}).get('code', '')
    desc = e.get('description', '').lower()

    # Verificar se e salario CLT
    is_salary = False
    for name in clt_names:
        if name in desc:
            is_salary = True
            by_person[name] += e['total_debit']
            break

    if is_salary and e['entry_type'] == 'pagamento_despesa':
        print(f"  {e['entry_date']} | {e['description'][:55]:55} | R$ {e['total_debit']:>10,.2f} | {cc}")
        total_clt += e['total_debit']

print(f"\n  TOTAL SALARIOS CLT: R$ {total_clt:,.2f}")

print("\n\n[RESUMO POR FUNCIONARIO]")
print("-" * 60)
for name, total in sorted(by_person.items(), key=lambda x: -x[1]):
    print(f"  {name.upper():20} R$ {total:>12,.2f}")

# FGTS
print("\n\n[ANALISE FGTS]")
print("-" * 60)
fgts_items = [e for e in entries if (e.get('cost_centers') or {}).get('code') == '1.17']
total_fgts = sum(e['total_debit'] for e in fgts_items)

print(f"  Total FGTS pago:           R$ {total_fgts:>12,.2f}")
print(f"  Folha estimada (FGTS/8%):  R$ {total_fgts / 0.08:>12,.2f}")
print(f"  Salarios CLT encontrados:  R$ {total_clt:>12,.2f}")
print(f"  Diferenca:                 R$ {(total_fgts / 0.08) - total_clt:>12,.2f}")

print("\n\n[OBSERVACAO]")
print("-" * 120)
print("A diferenca pode indicar:")
print("  1. Funcionarios domesticos (Fabiana, Claudia, Raimundo) que tem FGTS mas sao adiantamento_socio")
print("  2. Funcionarios CLT de outros departamentos nao identificados")
print("  3. FGTS de meses anteriores pago em janeiro")

# Verificar adiantamentos que podem ser funcionarios domesticos
print("\n\n[POSSIVEIS DOMESTICOS COM FGTS]")
print("-" * 120)
domesticos = ['fabiana', 'claudia', 'raimundo']
for e in entries:
    desc = e.get('description', '').lower()
    for name in domesticos:
        if name in desc:
            cc = (e.get('cost_centers') or {}).get('code', 'N/A')
            print(f"  {e['entry_date']} | {e['description'][:50]:50} | R$ {e['total_debit']:>10,.2f} | {cc} | {e['entry_type']}")
            break
