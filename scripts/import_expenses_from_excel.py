#!/usr/bin/env python3
"""
Script para importar despesas recorrentes do arquivo "Controle Despesas-1.xlsx"
para a tabela accounts_payable do Supabase.
"""

import os
import sys
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Carregar variáveis de ambiente
load_dotenv()

# Configuração Supabase (opcional - pode rodar sem conexão para apenas listar)
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_ANON_KEY") or os.getenv("VITE_SUPABASE_PUBLISHABLE_KEY")

supabase = None

def init_supabase():
    """Inicializa conexão com Supabase apenas quando necessário."""
    global supabase
    if supabase is not None:
        return True
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        print("⚠️ Supabase não configurado. Use opção 2 ou 3 para exportar CSV.")
        print("   Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env para importar.")
        return False
    
    try:
        from supabase import create_client, Client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        return True
    except Exception as e:
        print(f"❌ Erro ao conectar ao Supabase: {e}")
        return False

# Mapeamento de categorias
CATEGORY_MAPPING = {
    # SERGIO CARNEIRO (despesas pessoais)
    "Água": {"category": "UTILITIES", "owner": "SERGIO", "subcategory": "water"},
    "Antônio Leandro - Personal": {"category": "PERSONAL", "owner": "SERGIO", "subcategory": "personal_trainer"},
    "Condomínio Galeria Nacional": {"category": "HOUSING", "owner": "SERGIO", "subcategory": "condominium"},
    "Condomínio Lago": {"category": "HOUSING", "owner": "SERGIO", "subcategory": "condominium"},
    "Condomínio Mundi": {"category": "HOUSING", "owner": "SERGIO", "subcategory": "condominium"},
    "Energia": {"category": "UTILITIES", "owner": "SERGIO", "subcategory": "electricity"},
    "Gás": {"category": "UTILITIES", "owner": "SERGIO", "subcategory": "gas"},
    "Internet": {"category": "UTILITIES", "owner": "SERGIO", "subcategory": "internet"},
    "IPTU": {"category": "TAXES", "owner": "SERGIO", "subcategory": "property_tax"},
    "IPVA BMW, Biz e CG": {"category": "TAXES", "owner": "SERGIO", "subcategory": "vehicle_tax"},
    "Obras Lago": {"category": "HOUSING", "owner": "SERGIO", "subcategory": "construction"},
    "Plano de Saúde": {"category": "HEALTHCARE", "owner": "SERGIO", "subcategory": "health_insurance"},
    "Telefone": {"category": "UTILITIES", "owner": "SERGIO", "subcategory": "phone"},
    "Tharson Diego": {"category": "SERVICES", "owner": "SERGIO", "subcategory": "services"},
    
    # AMPLA CONTABILIDADE - CONTAS FIXAS
    "Nayara": {"category": "PAYROLL", "owner": "AMPLA", "subcategory": "salary"},
    "Sérgio Augusto": {"category": "PAYROLL", "owner": "AMPLA", "subcategory": "prolabore"},
    "Victor Hugo": {"category": "PAYROLL", "owner": "AMPLA", "subcategory": "salary"},
    "Sistemas - Aplicativos": {"category": "SOFTWARE", "owner": "AMPLA", "subcategory": "systems"},
    "Telefone Celular": {"category": "UTILITIES", "owner": "AMPLA", "subcategory": "mobile"},
    "Telefone Fixo": {"category": "UTILITIES", "owner": "AMPLA", "subcategory": "landline"},
    "Vale Alimentação": {"category": "BENEFITS", "owner": "AMPLA", "subcategory": "food_voucher"},
    "Vale Transporte": {"category": "BENEFITS", "owner": "AMPLA", "subcategory": "transport_voucher"},
    
    # AMPLA - IMPOSTOS
    "FGTS": {"category": "TAXES", "owner": "AMPLA", "subcategory": "fgts"},
    "INSS e IRRF": {"category": "TAXES", "owner": "AMPLA", "subcategory": "inss_irrf"},
    "IPTU 2018": {"category": "TAXES", "owner": "AMPLA", "subcategory": "property_tax"},
    "IPTU 2022": {"category": "TAXES", "owner": "AMPLA", "subcategory": "property_tax"},
    "IPTU 2024": {"category": "TAXES", "owner": "AMPLA", "subcategory": "property_tax"},
    "ISS Prórprio": {"category": "TAXES", "owner": "AMPLA", "subcategory": "iss"},
    "Simples Nacional": {"category": "TAXES", "owner": "AMPLA", "subcategory": "simples"},
    
    # AMPLA - CONTAS VARIÁVEIS
    "Comissão": {"category": "COMMISSIONS", "owner": "AMPLA", "subcategory": "commission"},
    "Empréstimos": {"category": "LOANS", "owner": "AMPLA", "subcategory": "loan"},
    "Eventuais": {"category": "MISCELLANEOUS", "owner": "AMPLA", "subcategory": "eventual"},
    "Manutenção": {"category": "MAINTENANCE", "owner": "AMPLA", "subcategory": "maintenance"},
    "Rescisão": {"category": "PAYROLL", "owner": "AMPLA", "subcategory": "severance"},
    "Uniformes": {"category": "SUPPLIES", "owner": "AMPLA", "subcategory": "uniforms"},
    
    # AMPLA - SERVIÇO TERCEIROS
    "Dep. Fiscal": {"category": "OUTSOURCING", "owner": "AMPLA", "subcategory": "fiscal_dept"},
    "Dep. Legalização": {"category": "OUTSOURCING", "owner": "AMPLA", "subcategory": "legal_dept"},
    "Dep. Limpeza": {"category": "OUTSOURCING", "owner": "AMPLA", "subcategory": "cleaning"},
    "Dep. Pessoal": {"category": "OUTSOURCING", "owner": "AMPLA", "subcategory": "hr_dept"},
    "Dep. Psicologia": {"category": "OUTSOURCING", "owner": "AMPLA", "subcategory": "psychology"},
    
    # AMPLA - FOLHA PAGAMENTO
    "Babá": {"category": "PAYROLL", "owner": "AMPLA", "subcategory": "nanny"},
    "Dep. Contábil": {"category": "PAYROLL", "owner": "AMPLA", "subcategory": "accounting_dept"},
    "Dep. Financeiro": {"category": "PAYROLL", "owner": "AMPLA", "subcategory": "financial_dept"},
    
    # AMPLA - MATERIAL DE CONSUMO
    "Açucar": {"category": "SUPPLIES", "owner": "AMPLA", "subcategory": "consumables"},
    "Água Mineral": {"category": "SUPPLIES", "owner": "AMPLA", "subcategory": "consumables"},
    "Bolachas": {"category": "SUPPLIES", "owner": "AMPLA", "subcategory": "consumables"},
    "Café": {"category": "SUPPLIES", "owner": "AMPLA", "subcategory": "consumables"},
    "Material de Limpeza": {"category": "SUPPLIES", "owner": "AMPLA", "subcategory": "cleaning"},
    "Outros": {"category": "MISCELLANEOUS", "owner": "AMPLA", "subcategory": "others"},
    "Papelaria": {"category": "SUPPLIES", "owner": "AMPLA", "subcategory": "stationery"},
    "Remédios": {"category": "HEALTHCARE", "owner": "AMPLA", "subcategory": "medicine"},
}

# Linhas de título/subtítulo para ignorar
TITLE_ROWS = [
    "SERGIO CARNEIRO",
    "TOTAL CUSTO AMPLA CONTABILIDADE", 
    "CONTAS FIXAS",
    "IMPOSTOS",
    "CONTAS VARIÁVEIS",
    "SERVIÇO TERCEIROS",
    "FOLHA PAGAMENTO",
    "MATERIAL DE CONSUMO",
    "RESULTADO CONTÁBIL DO PERÍODO",
    "TOTAL SAÍDAS (SERGIO + AMPLA)",
    "MOVIMENTO FINANCEIRO",
    "HONORÁRIO MENSAL",
    "HONORÁRIO 2,87%",
]


def parse_excel_file(file_path: str) -> list:
    """
    Analisa o arquivo Excel e extrai as despesas.
    """
    print(f"📖 Lendo arquivo: {file_path}")
    
    df = pd.read_excel(file_path)
    
    # Renomear colunas
    df.columns = ['description', 'col1', 'nov_2024', 'nov_pct', 'col4', 'dec_2024', 'dec_pct', 'col7', 'bonus_13']
    
    expenses = []
    current_owner = None
    current_group = None
    
    for idx, row in df.iterrows():
        description = str(row['description']).strip() if pd.notna(row['description']) else ""
        
        # Ignorar linhas vazias
        if not description or description == 'nan':
            continue
            
        # Ignorar linhas de título/cabeçalho
        if description in TITLE_ROWS:
            if description == "SERGIO CARNEIRO":
                current_owner = "SERGIO"
                current_group = "PESSOAL"
            elif description == "TOTAL CUSTO AMPLA CONTABILIDADE":
                current_owner = "AMPLA"
                current_group = "EMPRESA"
            elif description in ["CONTAS FIXAS", "IMPOSTOS", "CONTAS VARIÁVEIS", "SERVIÇO TERCEIROS", "FOLHA PAGAMENTO", "MATERIAL DE CONSUMO"]:
                current_group = description
            continue
        
        # Ignorar linhas que começam com "Faturamento", "Recebidos", etc (seção de honorários)
        if description in ["Faturamento", "Repasse (Nayara e Victor)", "Juros/Multa", "Total Recebido", "A Receber", "Recebidos", "Empresa", "Action", "Ipê Comércio", "Mata Pragras"]:
            continue
            
        # Pegar valores de novembro e dezembro
        nov_value = row['nov_2024'] if pd.notna(row['nov_2024']) else 0
        dec_value = row['dec_2024'] if pd.notna(row['dec_2024']) else 0
        
        # Converter para float
        try:
            nov_value = float(nov_value) if nov_value else 0
            dec_value = float(dec_value) if dec_value else 0
        except:
            continue
        
        # Ignorar se ambos valores são zero
        if nov_value == 0 and dec_value == 0:
            continue
        
        # Buscar mapeamento de categoria
        mapping = CATEGORY_MAPPING.get(description, {
            "category": "MISCELLANEOUS",
            "owner": current_owner or "AMPLA",
            "subcategory": "other"
        })
        
        # Usar o maior valor como estimativa para recorrência
        avg_value = max(nov_value, dec_value) if nov_value > 0 or dec_value > 0 else 0
        
        if avg_value > 0:
            expense = {
                "description": description,
                "amount": round(avg_value, 2),
                "category": mapping["category"],
                "owner": mapping["owner"],
                "subcategory": mapping["subcategory"],
                "group": current_group,
                "nov_2024": round(nov_value, 2),
                "dec_2024": round(dec_value, 2),
                "is_recurring": True,
            }
            expenses.append(expense)
            print(f"  ✅ {description}: R$ {avg_value:.2f} ({mapping['category']})")
    
    return expenses


def import_to_supabase(expenses: list, dry_run: bool = True) -> dict:
    """
    Importa despesas para o Supabase.
    """
    if not init_supabase():
        return {"inserted": 0, "updated": 0, "skipped": 0, "errors": ["Supabase não conectado"]}
    
    results = {
        "inserted": 0,
        "updated": 0,
        "skipped": 0,
        "errors": []
    }
    
    for expense in expenses:
        try:
            # Verificar se já existe
            existing = supabase.table("recurring_expenses").select("*").eq("description", expense["description"]).execute()
            
            record = {
                "description": expense["description"],
                "estimated_amount": expense["amount"],
                "category": expense["category"],
                "owner_type": expense["owner"],
                "expense_group": expense["group"],
                "is_active": True,
                "recurrence_day": 10,  # Dia padrão para vencimento
                "notes": f"Importado de Controle Despesas. Nov: R$ {expense['nov_2024']:.2f}, Dec: R$ {expense['dec_2024']:.2f}"
            }
            
            if dry_run:
                print(f"  [DRY-RUN] Inserir: {expense['description']} - R$ {expense['amount']:.2f}")
                results["inserted"] += 1
            else:
                if existing.data:
                    # Atualizar
                    supabase.table("recurring_expenses").update(record).eq("id", existing.data[0]["id"]).execute()
                    results["updated"] += 1
                    print(f"  🔄 Atualizado: {expense['description']}")
                else:
                    # Inserir
                    supabase.table("recurring_expenses").insert(record).execute()
                    results["inserted"] += 1
                    print(f"  ✅ Inserido: {expense['description']}")
                    
        except Exception as e:
            results["errors"].append(f"{expense['description']}: {str(e)}")
            print(f"  ❌ Erro em {expense['description']}: {e}")
    
    return results


def import_to_accounts_payable(expenses: list, dry_run: bool = True) -> dict:
    """
    Importa despesas para accounts_payable como contas a pagar.
    """
    if not init_supabase():
        return {"inserted": 0, "skipped": 0, "errors": ["Supabase não conectado"]}
    
    results = {
        "inserted": 0,
        "skipped": 0,
        "errors": []
    }
    
    # Gerar contas para o próximo mês
    today = datetime.now()
    next_month = today.replace(day=1) + timedelta(days=32)
    next_month = next_month.replace(day=10)  # Dia 10 do próximo mês
    
    for expense in expenses:
        try:
            # Verificar se já existe conta para este mês
            start_of_month = next_month.replace(day=1)
            end_of_month = (start_of_month + timedelta(days=32)).replace(day=1) - timedelta(days=1)
            
            existing = supabase.table("accounts_payable").select("*").eq(
                "description", expense["description"]
            ).gte("due_date", start_of_month.isoformat()).lte(
                "due_date", end_of_month.isoformat()
            ).execute()
            
            if existing.data:
                print(f"  ⏭️ Já existe: {expense['description']} para {next_month.strftime('%m/%Y')}")
                results["skipped"] += 1
                continue
            
            record = {
                "description": expense["description"],
                "amount": expense["amount"],
                "due_date": next_month.strftime("%Y-%m-%d"),
                "category": expense["category"],
                "status": "pending",
                "is_recurring": True,
                "recurrence_day": 10,
                "notes": f"Auto-gerado de despesa recorrente. Categoria: {expense['group']}"
            }
            
            if dry_run:
                print(f"  [DRY-RUN] Criar conta: {expense['description']} - R$ {expense['amount']:.2f} - Venc: {next_month.strftime('%d/%m/%Y')}")
                results["inserted"] += 1
            else:
                supabase.table("accounts_payable").insert(record).execute()
                results["inserted"] += 1
                print(f"  ✅ Conta criada: {expense['description']} - Venc: {next_month.strftime('%d/%m/%Y')}")
                    
        except Exception as e:
            results["errors"].append(f"{expense['description']}: {str(e)}")
            print(f"  ❌ Erro em {expense['description']}: {e}")
    
    return results


def review_and_approve_expenses(expenses: list) -> list:
    """
    Interface interativa para revisar cada despesa antes de importar.
    """
    approved = []
    skipped = []
    
    print("\n" + "=" * 70)
    print("REVISÃO DE DESPESAS - Analise cada item antes de aprovar")
    print("=" * 70)
    print("Comandos: [S]im/Enter=aprovar | [N]ão=pular | [E]ditar valor | [Q]uit=sair")
    print("=" * 70)
    
    for i, expense in enumerate(expenses, 1):
        print(f"\n{'─' * 70}")
        print(f"📋 ITEM {i}/{len(expenses)}")
        print(f"{'─' * 70}")
        print(f"  Descrição:   {expense['description']}")
        print(f"  Proprietário: {expense['owner']} ({expense['group']})")
        print(f"  Categoria:   {expense['category']}")
        print(f"  Nov/2024:    R$ {expense['nov_2024']:,.2f}")
        print(f"  Dez/2024:    R$ {expense['dec_2024']:,.2f}")
        print(f"  💰 VALOR:    R$ {expense['amount']:,.2f}")
        print(f"{'─' * 70}")
        
        while True:
            choice = input(f"  Aprovar este item? [S/n/e/q]: ").strip().lower()
            
            if choice in ['', 's', 'sim', 'y', 'yes']:
                approved.append(expense)
                print(f"  ✅ Aprovado!")
                break
            elif choice in ['n', 'nao', 'não', 'no']:
                skipped.append(expense)
                print(f"  ⏭️ Pulado")
                break
            elif choice in ['e', 'editar', 'edit']:
                try:
                    new_value = input(f"  Novo valor (atual: {expense['amount']:.2f}): R$ ").strip()
                    expense['amount'] = float(new_value.replace(',', '.'))
                    print(f"  📝 Valor alterado para R$ {expense['amount']:,.2f}")
                except:
                    print(f"  ⚠️ Valor inválido, mantendo original")
            elif choice in ['q', 'quit', 'sair']:
                print(f"\n⚠️ Revisão interrompida. {len(approved)} itens aprovados até agora.")
                confirm = input("  Deseja importar os itens já aprovados? [s/N]: ").strip().lower()
                if confirm in ['s', 'sim', 'y']:
                    return approved
                else:
                    return []
            else:
                print(f"  ❓ Opção inválida. Use S, N, E ou Q")
    
    print(f"\n{'=' * 70}")
    print(f"RESUMO DA REVISÃO")
    print(f"{'=' * 70}")
    print(f"  ✅ Aprovados: {len(approved)}")
    print(f"  ⏭️ Pulados:   {len(skipped)}")
    
    if skipped:
        print(f"\n  Itens pulados:")
        for s in skipped:
            print(f"    - {s['description']}: R$ {s['amount']:,.2f}")
    
    return approved


def export_to_csv(expenses: list, filename: str):
    """
    Exporta despesas aprovadas para CSV para revisão externa.
    """
    import csv
    
    filepath = os.path.join(os.path.dirname(__file__), "..", filename)
    
    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'description', 'amount', 'category', 'owner', 'group', 
            'nov_2024', 'dec_2024', 'is_recurring'
        ])
        writer.writeheader()
        writer.writerows(expenses)
    
    print(f"📄 Exportado para: {filepath}")
    return filepath


def main():
    print("=" * 70)
    print("IMPORTADOR DE DESPESAS - Controle Despesas-1.xlsx")
    print("=" * 70)
    
    # Caminho do arquivo
    file_path = os.path.join(os.path.dirname(__file__), "..", "banco", "Controle Despesas-1.xlsx")
    
    if not os.path.exists(file_path):
        print(f"❌ Arquivo não encontrado: {file_path}")
        sys.exit(1)
    
    # Extrair despesas
    print("\n📊 Analisando planilha...")
    expenses = parse_excel_file(file_path)
    
    print(f"\n📋 Total de despesas identificadas: {len(expenses)}")
    
    # Resumo por proprietário
    print("\n👤 Resumo por proprietário:")
    by_owner = {}
    for exp in expenses:
        owner = exp["owner"]
        by_owner[owner] = by_owner.get(owner, 0) + exp["amount"]
    
    for owner, total in sorted(by_owner.items(), key=lambda x: -x[1]):
        print(f"  {owner}: R$ {total:,.2f}")
    
    total_geral = sum(exp['amount'] for exp in expenses)
    print(f"\n  💰 TOTAL GERAL: R$ {total_geral:,.2f}")
    
    # Menu principal
    print("\n" + "=" * 70)
    print("OPÇÕES:")
    print("  1. Revisar e aprovar cada despesa individualmente")
    print("  2. Exportar para CSV (para revisar no Excel)")
    print("  3. Listar todas as despesas identificadas")
    print("  0. Cancelar")
    print("=" * 70)
    
    choice = input("\nEscolha uma opção [1]: ").strip() or "1"
    
    if choice == "0":
        print("❌ Operação cancelada.")
        return
    
    if choice == "2":
        export_to_csv(expenses, "despesas_para_revisar.csv")
        print("\n✅ Revise o arquivo CSV e execute novamente para importar.")
        return
    
    if choice == "3":
        print("\n📋 LISTA COMPLETA DE DESPESAS:")
        print("-" * 70)
        for i, exp in enumerate(expenses, 1):
            print(f"{i:2}. {exp['description']:<35} R$ {exp['amount']:>10,.2f}  ({exp['owner']}/{exp['category']})")
        print("-" * 70)
        print(f"    {'TOTAL:':<35} R$ {total_geral:>10,.2f}")
        return
    
    # Opção 1: Revisar uma a uma
    approved = review_and_approve_expenses(expenses)
    
    if not approved:
        print("\n❌ Nenhuma despesa aprovada para importação.")
        return
    
    # Confirmar importação
    print(f"\n{'=' * 70}")
    print(f"CONFIRMAÇÃO DE IMPORTAÇÃO")
    print(f"{'=' * 70}")
    print(f"  Despesas aprovadas: {len(approved)}")
    total_approved = sum(exp['amount'] for exp in approved)
    print(f"  Valor total: R$ {total_approved:,.2f}")
    
    print("\n  Para onde deseja importar?")
    print("    1. recurring_expenses (despesas recorrentes)")
    print("    2. accounts_payable (contas a pagar)")
    print("    3. Ambas as tabelas")
    print("    4. Exportar CSV dos aprovados (não importar)")
    print("    0. Cancelar")
    
    dest = input("\n  Destino [0]: ").strip() or "0"
    
    if dest == "0":
        print("❌ Importação cancelada. Nenhum dado foi alterado.")
        return
    
    if dest == "4":
        export_to_csv(approved, "despesas_aprovadas.csv")
        return
    
    # Última confirmação
    confirm = input(f"\n⚠️ CONFIRMA a importação de {len(approved)} itens? [s/N]: ").strip().lower()
    
    if confirm not in ['s', 'sim', 'y']:
        print("❌ Operação cancelada.")
        return
    
    # Executar importação
    if dest in ["1", "3"]:
        print(f"\n📥 Importando para recurring_expenses...")
        results = import_to_supabase(approved, dry_run=False)
        print(f"✅ {results['inserted']} inseridos, {results['updated']} atualizados")
    
    if dest in ["2", "3"]:
        print(f"\n📥 Criando contas em accounts_payable...")
        results = import_to_accounts_payable(approved, dry_run=False)
        print(f"✅ {results['inserted']} criados, {results['skipped']} ignorados")
    
    print("\n🎉 Processo finalizado!")


if __name__ == "__main__":
    main()
