#!/usr/bin/env python3
"""
Mapear despesas históricas para centros de custo corretos baseado em palavras-chave.

Este script identifica despesas do Sérgio e seus dependentes usando padrões de texto
(tags) definidos na migration, e atribui o centro de custo apropriado.

Uso:
    python scripts/map_expenses_to_cost_centers.py --dry-run
    python scripts/map_expenses_to_cost_centers.py --apply
"""

import os
import sys
import argparse
from datetime import datetime
from typing import Dict, List, Tuple

# Configurar PYTHONPATH se necessário
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Importar from supabase (se configurado)
try:
    from supabase import create_client
except ImportError:
    print("⚠️  Supabase client não instalado. Execute: pip install supabase")
    sys.exit(1)

# Padrões de palavras-chave para cada centro de custo do Sérgio
KEYWORD_MAPPINGS: Dict[str, List[str]] = {
    'SERGIO': [
        'PIX SERGIO', 'PAGAMENTO SERGIO', 'CARNEIRO LEAO'
    ],
    'SERGIO.FILHOS.NAYARA': [
        'BABA', 'BABÁ', 'ESCOLA', 'NAYARA', 'CRECHE',
        'INFANTIL', 'PRE', 'MATERNAL'
    ],
    'SERGIO.FILHOS.VICTOR': [
        'VICTOR', 'VICTOR HUGO', 'LEGALIZACAO', 'LEGALIZAÇÃO',
        'VICTOR HUGO DE OLIVEIRA'
    ],
    'SERGIO.FILHOS.SERGIO_AUGUSTO': [
        'CLINICA AMPLA', 'CLÍNICA AMPLA', 'MEDICINA', 'SERGIO AUGUSTO',
        'AUGUSTO DE OLIVEIRA', 'TRABALHO'
    ],
    'SERGIO.CASA_CAMPO': [
        'LAGO BRISAS', 'BURITI ALEGRE', 'CONDOMINIO LAGO',
        'CONDOMÍNIO LAGO', 'CASA CAMPO', 'BRISAS'
    ],
    'SERGIO.IMOVEIS': [
        'IPTU', 'CONDOMINIO', 'CONDOMÍNIO', 'MARISTA',
        'APTO', 'APARTAMENTO', 'SALA', 'IMOVEL', 'PROPRIEDADE',
        '301', '302', '303', 'VILA ABAJA', 'ABAJA'
    ],
    'SERGIO.VEICULOS': [
        'IPVA', 'BMW', 'MOTO', 'BIZ', 'CG', 'CARRETINHA',
        'REBOQUE', 'DETRAN', 'COMBUSTIVEL', 'COMBUSTÍVEL',
        'GASOLINA', 'MANUTENCAO', 'MANUTENÇÃO', 'MECANICO', 'MECÂNICO'
    ],
    'SERGIO.PESSOAL': [
        'PLANO DE SAUDE', 'PLANO SAÚDE', 'SAUDE', 'SAÚDE',
        'PERSONAL', 'ACADEMIA', 'CRC', 'ANUIDADE',
        'DOCTOR', 'MEDICO', 'MÉDICO', 'DENTISTA'
    ],
    'SERGIO.TELEFONE': [
        'CLARO', 'VIVO', 'TIM', 'TELEFONE', 'CELULAR',
        'PLANO', 'TELEFONICA', 'TELECOMUNICACOES'
    ],
}

class ExpenseCostCenterMapper:
    def __init__(self, supabase_url: str, supabase_key: str):
        self.supabase = create_client(supabase_url, supabase_key)
        self.mapping_log: List[Dict] = []
        
    def fetch_unmapped_expenses(self) -> List[Dict]:
        """Buscar despesas sem centro de custo ou com AMPLA padrão."""
        try:
            result = self.supabase.table('expenses').select('*').or_(
                'cost_center_id.is.null,'
                'cost_center_id.eq.' + self._get_ampla_id()
            ).execute()
            return result.data if result.data else []
        except Exception as e:
            print(f"❌ Erro ao buscar despesas: {e}")
            return []
    
    def _get_ampla_id(self) -> str:
        """Buscar ID do centro AMPLA."""
        try:
            result = self.supabase.table('cost_centers').select('id').eq('code', 'AMPLA').limit(1).execute()
            if result.data:
                return result.data[0]['id']
        except Exception:
            pass
        return ''
    
    def _get_cost_center_id(self, code: str) -> str:
        """Buscar ID do centro de custo pelo código."""
        try:
            result = self.supabase.table('cost_centers').select('id').eq('code', code).limit(1).execute()
            if result.data:
                return result.data[0]['id']
        except Exception:
            pass
        return ''
    
    def map_expense(self, expense: Dict) -> Tuple[str, str, bool]:
        """
        Mapear uma despesa para o centro de custo apropriado.
        
        Retorna: (cost_center_code, cost_center_id, encontrado)
        """
        description = expense.get('description', '').upper()
        
        # Buscar melhor match nas palavras-chave
        best_match = 'SERGIO'  # Centro padrão para despesas do Sérgio
        max_matches = 0
        
        for cost_center, keywords in KEYWORD_MAPPINGS.items():
            matches = sum(1 for kw in keywords if kw in description)
            if matches > max_matches:
                max_matches = matches
                best_match = cost_center
        
        # Se encontrou palavra-chave, retornar o match
        if max_matches > 0:
            cost_center_id = self._get_cost_center_id(best_match)
            return best_match, cost_center_id, True
        
        # Padrão: SERGIO se não encontrou nada mais específico
        cost_center_id = self._get_cost_center_id('SERGIO')
        return 'SERGIO', cost_center_id, False
    
    def process_expenses(self, dry_run: bool = True) -> Dict:
        """Processar todas as despesas não mapeadas."""
        print("\n🔍 Buscando despesas não mapeadas...")
        expenses = self.fetch_unmapped_expenses()
        
        if not expenses:
            print("✅ Nenhuma despesa para mapear.")
            return {'total': 0, 'mapped': 0, 'errors': 0}
        
        print(f"📊 Encontradas {len(expenses)} despesas para mapear\n")
        
        mapped_count = 0
        error_count = 0
        updates = []
        
        for expense in expenses:
            expense_id = expense['id']
            description = expense.get('description', 'N/A')
            
            try:
                cost_center_code, cost_center_id, found = self.map_expense(expense)
                
                if cost_center_id:
                    status_icon = '✅' if found else '⏹️'
                    print(f"{status_icon} {description[:60]:<60} → {cost_center_code}")
                    
                    if not dry_run:
                        updates.append({
                            'expense_id': expense_id,
                            'cost_center_id': cost_center_id,
                            'cost_center_code': cost_center_code
                        })
                    
                    self.mapping_log.append({
                        'expense_id': expense_id,
                        'description': description,
                        'cost_center_code': cost_center_code,
                        'found': found
                    })
                    mapped_count += 1
                else:
                    print(f"❌ {description[:60]:<60} → ERRO: Centro não encontrado")
                    error_count += 1
                    
            except Exception as e:
                print(f"❌ {description[:60]:<60} → ERRO: {str(e)}")
                error_count += 1
        
        # Aplicar updates se não é dry-run
        if not dry_run and updates:
            print(f"\n💾 Aplicando {len(updates)} atualizações...")
            for update in updates:
                try:
                    self.supabase.table('expenses').update({
                        'cost_center_id': update['cost_center_id']
                    }).eq('id', update['expense_id']).execute()
                except Exception as e:
                    print(f"❌ Erro ao atualizar {update['expense_id']}: {e}")
                    error_count += 1
            print(f"✅ {len(updates)} despesas atualizadas")
        
        return {
            'total': len(expenses),
            'mapped': mapped_count,
            'errors': error_count,
            'dry_run': dry_run
        }
    
    def print_summary(self, results: Dict):
        """Imprimir sumário dos resultados."""
        print("\n" + "=" * 70)
        print(f"{'SUMÁRIO DO MAPEAMENTO':<70}")
        print("=" * 70)
        print(f"Total de despesas processadas: {results['total']}")
        print(f"Despesas mapeadas: {results['mapped']}")
        print(f"Erros: {results['errors']}")
        if results['dry_run']:
            print("\n⚠️  MODO DRY-RUN: Nenhuma mudança foi aplicada")
            print("Execute com --apply para aplicar as alterações")
        else:
            print("\n✅ Alterações aplicadas com sucesso")
        print("=" * 70 + "\n")

def main():
    parser = argparse.ArgumentParser(
        description='Mapear despesas históricas para centros de custo'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        default=True,
        help='Simular alterações sem aplicar (padrão)'
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Aplicar alterações no banco de dados'
    )
    parser.add_argument(
        '--url',
        help='URL do Supabase (padrão: VITE_SUPABASE_URL)'
    )
    parser.add_argument(
        '--key',
        help='Chave do Supabase (padrão: VITE_SUPABASE_PUBLISHABLE_KEY)'
    )
    
    args = parser.parse_args()
    
    # Obter credenciais
    supabase_url = args.url or os.getenv('VITE_SUPABASE_URL')
    supabase_key = args.key or os.getenv('VITE_SUPABASE_PUBLISHABLE_KEY')
    
    if not supabase_url or not supabase_key:
        print("❌ Credenciais do Supabase não configuradas")
        print("   Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY")
        sys.exit(1)
    
    print("🚀 Inicializando mapeador de centros de custo...")
    print(f"📍 Supabase URL: {supabase_url}\n")
    
    mapper = ExpenseCostCenterMapper(supabase_url, supabase_key)
    
    # Processar com mode apropriado
    dry_run = not args.apply
    results = mapper.process_expenses(dry_run=dry_run)
    mapper.print_summary(results)

if __name__ == '__main__':
    main()
