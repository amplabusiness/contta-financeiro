import requests

SUPABASE_URL = "https://xdtlhzysrpoinqtsglmr.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI"

headers = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
}

response = requests.get(
    f"{SUPABASE_URL}/rest/v1/accounting_entries?entry_date=gte.2025-01-01&entry_date=lte.2025-01-31&cost_center_id=is.null&select=*",
    headers=headers
)
entries = response.json()

print(f"Lancamentos SEM centro de custo: {len(entries)}")
print("=" * 120)

for e in entries:
    print(f"{e['entry_date']} | {e['description'][:60]:60} | R$ {e['total_debit']:>10,.2f} | {e['entry_type']}")
