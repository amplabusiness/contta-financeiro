import requests
from collections import defaultdict

SUPABASE_URL = "https://xdtlhzysrpoinqtsglmr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

# Buscar lançamentos de janeiro 2025
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/accounting_entries?entry_date=gte.2025-01-01&entry_date=lte.2025-01-31&select=*,cost_centers(code,name,parent_id)",
    headers=headers
)
entries = response.json()

# Buscar centros de custo
response = requests.get(
    f"{SUPABASE_URL}/rest/v1/cost_centers?select=*",
    headers=headers
)
cost_centers = {cc['id']: cc for cc in response.json()}

print("=" * 100)
print("DRE - DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO - JANEIRO 2025")
print("=" * 100)

# Separar por tipo
by_type = defaultdict(list)
for e in entries:
    by_type[e['entry_type']].append(e)

# RECEITAS
print("\n[+] RECEITAS")
print("-" * 100)
receitas = [e for e in entries if e['entry_type'] == 'receita_honorarios']
total_receitas = sum(e['total_credit'] for e in receitas)
print(f"Honorários recebidos: R$ {total_receitas:,.2f}")

# DESPESAS (apenas pagamento_despesa)
print("\n[-] DESPESAS OPERACIONAIS")
print("-" * 100)

# Filtrar apenas pagamento_despesa COM centro de custo (ignora duplicados sem CC)
despesas = [e for e in entries if e['entry_type'] == 'pagamento_despesa' and e.get('cost_centers')]

# Agrupar por centro de custo
by_cc = defaultdict(lambda: {'total': 0, 'items': []})
for e in despesas:
    cc = e.get('cost_centers') or {}
    cc_code = cc.get('code', 'SEM_CC')
    cc_name = cc.get('name', 'Sem Centro de Custo')
    by_cc[cc_code]['name'] = cc_name
    by_cc[cc_code]['total'] += e['total_debit']
    by_cc[cc_code]['items'].append(e)

total_despesas = 0
for code in sorted(by_cc.keys()):
    data = by_cc[code]
    print(f"\n  {code:15} {data['name']:40} R$ {data['total']:>12,.2f}")
    total_despesas += data['total']
    for item in data['items']:
        print(f"                   -- {item['description'][:50]:50} R$ {item['total_debit']:>10,.2f}")

print(f"\n{'-' * 100}")
print(f"TOTAL DESPESAS OPERACIONAIS: R$ {total_despesas:,.2f}")

# RESULTADO
print(f"\n{'=' * 100}")
print(f"RESULTADO OPERACIONAL (Receitas - Despesas): R$ {total_receitas - total_despesas:,.2f}")
print(f"{'=' * 100}")

# ADIANTAMENTOS (não entram no DRE, mas mostramos para referência)
print("\n\n[*] ADIANTAMENTOS A SOCIOS (Nao entram no DRE - vao para Ativo)")
print("-" * 100)
adiantamentos = [e for e in entries if e['entry_type'] == 'adiantamento_socio']
by_cc_adiant = defaultdict(lambda: {'total': 0, 'items': []})
for e in adiantamentos:
    cc = e.get('cost_centers') or {}
    cc_code = cc.get('code', 'SEM_CC')
    cc_name = cc.get('name', 'Sem Centro de Custo')
    by_cc_adiant[cc_code]['name'] = cc_name
    by_cc_adiant[cc_code]['total'] += e['total_debit']

total_adiantamentos = 0
for code in sorted(by_cc_adiant.keys()):
    data = by_cc_adiant[code]
    print(f"  {code:15} {data['name']:40} R$ {data['total']:>12,.2f}")
    total_adiantamentos += data['total']

print(f"\nTOTAL ADIANTAMENTOS: R$ {total_adiantamentos:,.2f}")

# TRANSFERÊNCIAS INTERNAS
print("\n\n[=] TRANSFERENCIAS INTERNAS (Nao entram no DRE)")
print("-" * 100)
transferencias = [e for e in entries if e['entry_type'] == 'transferencia_interna']
total_transferencias = sum(e['total_debit'] for e in transferencias)
print(f"TOTAL TRANSFERÊNCIAS: R$ {total_transferencias:,.2f}")

# PASSIVOS
print("\n\n[!] PASSIVOS/OBRIGACOES (Nao entram no DRE)")
print("-" * 100)
passivos = [e for e in entries if e['entry_type'] == 'passivo_obrigacao']
total_passivos = sum(e['total_debit'] for e in passivos)
for e in passivos:
    print(f"  {e['description']:60} R$ {e['total_debit']:>10,.2f}")
print(f"\nTOTAL PASSIVOS: R$ {total_passivos:,.2f}")

# RESUMO FINAL
print("\n\n" + "=" * 100)
print("RESUMO FINANCEIRO JANEIRO 2025")
print("=" * 100)
print(f"Receitas de Honorários:      R$ {total_receitas:>15,.2f}")
print(f"Despesas Operacionais:       R$ {total_despesas:>15,.2f}")
print(f"{'-' * 50}")
print(f"RESULTADO OPERACIONAL:       R$ {total_receitas - total_despesas:>15,.2f}")
print(f"{'-' * 50}")
print(f"Adiantamentos a Sócios:      R$ {total_adiantamentos:>15,.2f}")
print(f"Transferências Internas:     R$ {total_transferencias:>15,.2f}")
print(f"Passivos/Obrigações:         R$ {total_passivos:>15,.2f}")
