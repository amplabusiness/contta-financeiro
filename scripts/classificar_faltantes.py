import re
import requests
from collections import defaultdict

SUPABASE_URL = 'https://xdtlhzysrpoinqtsglmr.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkdGxoenlzcnBvaW5xdHNnbG1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzEyNzQ0OSwiZXhwIjoyMDc4NzAzNDQ5fQ.VRFn_C-S01Pt4uBp_ZzdB6ZmsRSP0-oKGXru73qSSQI'

headers = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
}

# Buscar centros de custo
response = requests.get(f'{SUPABASE_URL}/rest/v1/cost_centers?select=id,code,name', headers=headers)
cost_centers = {cc['code']: cc for cc in response.json()}

# Extrair saidas do extrato OFX
with open('banco/jan 2025.ofx', 'r', encoding='latin-1') as f:
    content = f.read()

transactions = re.findall(r'<STMTTRN>(.*?)</STMTTRN>', content, re.DOTALL)

extrato_saidas = []
for tx in transactions:
    dtposted = re.search(r'<DTPOSTED>(\d{8})', tx)
    trnamt = re.search(r'<TRNAMT>(-?[\d.]+)', tx)
    memo = re.search(r'<MEMO>([^<]+)', tx)

    if dtposted and trnamt and memo:
        date = dtposted.group(1)
        amount = float(trnamt.group(1))
        desc = memo.group(1).strip()

        if amount < 0:
            extrato_saidas.append({
                'date': f'{date[:4]}-{date[4:6]}-{date[6:8]}',
                'desc': desc,
                'amount': abs(amount)
            })

# Buscar lancamentos do sistema
response = requests.get(
    f'{SUPABASE_URL}/rest/v1/accounting_entries?entry_date=gte.2025-01-01&entry_date=lte.2025-01-31&select=entry_date,total_debit,entry_type',
    headers=headers
)
sistema_entries = response.json()

tipos_saida_real = ['pagamento_despesa', 'adiantamento_socio', 'transferencia_interna']

# Agrupar sistema por (data, valor)
sistema_by_key = defaultdict(int)
for e in sistema_entries:
    if e['entry_type'] in tipos_saida_real:
        key = (e['entry_date'], round(e['total_debit'], 2))
        sistema_by_key[key] += 1

# Encontrar faltantes
faltantes = []
extrato_by_key = defaultdict(list)
for e in extrato_saidas:
    key = (e['date'], round(e['amount'], 2))
    extrato_by_key[key].append(e)

for key, items in extrato_by_key.items():
    sistema_count = sistema_by_key.get(key, 0)
    if len(items) > sistema_count:
        for i in range(len(items) - sistema_count):
            faltantes.append(items[i])

# Regras de classificacao automatica
def classificar(desc, amount):
    desc_upper = desc.upper()

    # TARIFAS BANCARIAS
    if 'TARIFA COM R LIQUIDACAO' in desc_upper or 'TARIFA' in desc_upper:
        return ('1.13.1', 'pagamento_despesa', 'Tarifa Boleto - Sicredi')
    if 'MANUTENCAO DE TITULOS' in desc_upper:
        return ('1.13.2', 'pagamento_despesa', 'Manutencao Titulos - Sicredi')
    if 'CESTA DE RELACIONAMENTO' in desc_upper:
        return ('1.13.3', 'pagamento_despesa', 'Cesta Relacionamento - Sicredi')

    # SISTEMAS / SOFTWARE
    if 'THOMSON REUTERS' in desc_upper or 'DOMINIO' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema Dominio - Thomson Reuters')
    if 'DATAUNIQUE' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema DATAUNIQUE')
    if 'CR SISTEMA' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema CR Sistema')
    if 'SITTAX' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema SITTAX')
    if 'CONTUS TECNOLOGIA' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema Contus')
    if 'CLICKSIGN' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema Clicksign')
    if 'PJBANK' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema PJBank')
    if 'NB TECHNOLOGY' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema NB Technology')
    if 'AUTMAIS' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema AutMais')
    if 'VERI SOLUCOES' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema Veri Solucoes')
    if 'ONEFLOW' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema Oneflow')
    if 'CATHO' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Sistema Catho (RH)')
    if 'OBJETIVA EDICOES' in desc_upper:
        return ('1.17', 'pagamento_despesa', 'Objetiva Edicoes (Publicacoes)')

    # TELEFONIA
    if 'TIMCEL' in desc_upper:
        return ('1.16', 'pagamento_despesa', 'Telefone Celular TIM')
    if 'VIVO' in desc_upper:
        return ('1.16', 'pagamento_despesa', 'Telefone Fixo VIVO')

    # ENERGIA
    if 'EQUATORIAL' in desc_upper:
        return ('1.15', 'pagamento_despesa', 'Energia Eletrica - Equatorial')

    # CONDOMINIO GALERIA NACIONAL (Ampla)
    if 'GALERIA NACIONAL' in desc_upper:
        return ('1.11', 'pagamento_despesa', 'Condominio Galeria Nacional - Ampla')

    # ELEVADOR
    if 'ADV SYSTEM ELEVADORES' in desc_upper:
        return ('1.12', 'pagamento_despesa', 'Manutencao Elevador - ADV System')

    # COPA / AGUA
    if 'AGUA PURA' in desc_upper:
        return ('1.14.1', 'pagamento_despesa', 'Agua Mineral - Agua Pura')

    # AMPLA SAUDE (Papelaria/Material)
    if 'AMPLA SAUDE OCUPACIONAL' in desc_upper:
        return ('1.21', 'pagamento_despesa', 'Material - Ampla Saude Ocupacional')

    # CRC ANUIDADE
    if 'CONS REG CONTABILIDADE' in desc_upper:
        return ('1.18', 'pagamento_despesa', 'Anuidade CRC')

    # FACTORING / FINANCEIRO
    if 'L ARGENT FACTORING' in desc_upper or 'FACTORING' in desc_upper:
        return ('1.22', 'pagamento_despesa', 'Factoring - L Argent')

    # MUNDI CONSCIENTE (Condominio Sergio)
    if 'MUNDI CONSCIENTE' in desc_upper:
        return ('3.1', 'adiantamento_socio', 'Condominio Mundi - Sergio')

    # TRANSFERENCIA AMPLA CONTABILIDADE
    if 'AMPLA CONTABILIDADE' in desc_upper and amount > 10000:
        return ('TRANSF', 'transferencia_interna', 'Transferencia para Ampla Contabilidade')

    # OUTSIDER CONSTRUTORA (Obras)
    if 'OUTSIDER' in desc_upper:
        return ('1.23', 'pagamento_despesa', 'Obras - Outsider Construtora')

    # FACULDADE MEDICINA ITUMBIARA (parece terceiro/cliente)
    if 'FACULDADE DE MEDICINA' in desc_upper:
        return ('VERIFICAR', None, 'Faculdade Medicina Itumbiara - VERIFICAR')

    # ALGARTE (Seguro?)
    if 'ALGARTE' in desc_upper:
        return ('1.24', 'pagamento_despesa', 'Seguro - Algarte')

    # NOVA VISAO IMPORTS
    if 'NOVA VISAO' in desc_upper:
        return ('VERIFICAR', None, 'Nova Visao Imports - VERIFICAR')

    # PIX MARKETPLACE
    if 'PIX MARKETPLACE' in desc_upper:
        return ('VERIFICAR', None, 'PIX Marketplace - VERIFICAR')

    # CENTER LUZZ
    if 'CENTER LUZZ' in desc_upper:
        return ('1.21', 'pagamento_despesa', 'Material Eletrico - Center Luzz')

    # SCALA CONTABILIDADE (Emprestimo)
    if 'SCALA CONTABILIDADE' in desc_upper:
        return ('3.2', 'adiantamento_socio', 'Emprestimo - Scala Contabilidade')

    # PESSOAS FISICAS - Adiantamentos familia
    if 'SERGIO AUGUSTO DE OLIVEIRA LEAO' in desc_upper or '75212650178' in desc:
        return ('3. SERGIO', 'adiantamento_socio', 'Adiantamento Sergio Augusto')
    if 'VICTOR HUGO LEAO' in desc_upper or '75212633168' in desc:
        return ('3.4', 'adiantamento_socio', 'Adiantamento Victor Hugo')
    if 'NAYARA CRISTINA PEREIRA LEAO' in desc_upper or '03788751169' in desc:
        return ('3.5', 'adiantamento_socio', 'Adiantamento Nayara')

    # TERCEIROS - Precisam verificacao
    if 'DANIEL RODRIGUES RIBEIRO' in desc_upper:
        return ('VERIFICAR', None, 'Daniel Rodrigues Ribeiro - VERIFICAR (Terceiro?)')
    if 'ALEXSSANDRA FERREIRA' in desc_upper:
        return ('VERIFICAR', None, 'Alexssandra Ferreira - VERIFICAR (Dep. Legalizacao?)')
    if 'TAYLANE' in desc_upper or '05799682190' in desc:
        return ('VERIFICAR', None, 'Taylane Belle - VERIFICAR (Terceira?)')
    if 'FABIANA MARIA' in desc_upper or '00141198117' in desc:
        return ('VERIFICAR', None, 'Fabiana Maria - VERIFICAR (Terceira?)')
    if 'ANTONIO LEANDRO' in desc_upper:
        return ('3. SERGIO', 'adiantamento_socio', 'Personal Antonio Leandro - Sergio')
    if 'MARIA APARECIDA GOMES' in desc_upper:
        return ('VERIFICAR', None, 'Maria Aparecida Gomes - VERIFICAR')

    return ('VERIFICAR', None, f'{desc[:50]} - NAO IDENTIFICADO')

# Classificar cada faltante
automaticos = []
para_verificar = []

for e in faltantes:
    cc_code, entry_type, desc_limpa = classificar(e['desc'], e['amount'])

    if cc_code == 'VERIFICAR' or cc_code == 'TRANSF':
        para_verificar.append({
            'date': e['date'],
            'amount': e['amount'],
            'desc_original': e['desc'],
            'sugestao': desc_limpa,
            'cc_code': cc_code
        })
    else:
        automaticos.append({
            'date': e['date'],
            'amount': e['amount'],
            'desc_original': e['desc'],
            'desc_limpa': desc_limpa,
            'cc_code': cc_code,
            'entry_type': entry_type
        })

print('LANCAMENTOS AUTOMATICOS (JA IDENTIFICADOS):')
print('=' * 120)
total_auto = 0
for a in sorted(automaticos, key=lambda x: (x['date'], -x['amount'])):
    print(f"{a['date']} | R$ {a['amount']:>10,.2f} | {a['cc_code']:<10} | {a['desc_limpa'][:60]}")
    total_auto += a['amount']
print(f'TOTAL AUTOMATICO: R$ {total_auto:,.2f} ({len(automaticos)} lancamentos)')

print()
print('LANCAMENTOS PARA VERIFICAR COM USUARIO:')
print('=' * 120)
total_ver = 0
for v in sorted(para_verificar, key=lambda x: (x['date'], -x['amount'])):
    print(f"{v['date']} | R$ {v['amount']:>10,.2f} | {v['sugestao'][:70]}")
    total_ver += v['amount']
print(f'TOTAL PARA VERIFICAR: R$ {total_ver:,.2f} ({len(para_verificar)} lancamentos)')

# Salvar automaticos para gerar SQL
import json
with open('_automaticos.json', 'w', encoding='utf-8') as f:
    json.dump(automaticos, f, ensure_ascii=False, indent=2)
with open('_para_verificar.json', 'w', encoding='utf-8') as f:
    json.dump(para_verificar, f, ensure_ascii=False, indent=2)
