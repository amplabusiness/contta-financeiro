import pdfplumber
import json
import re

pdf_path = r'C:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1\folha_pgto\FOLHA AMPLA JAN.pdf'

employees_data = []

with pdfplumber.open(pdf_path) as pdf:
    for page_num, page in enumerate(pdf.pages):
        text = page.extract_text()
        
        # Extrair informações do cabeçalho
        # AMPLA CONTABILIDADE LTDA
        # CNPJ: 23.893.032/0001-69 CC: CUSTOS OPERACIONAIS Folha Mensal
        # Mensalista Janeiro de 2025
        
        # Código Nome do Funcionário CBO Departamento Filial
        # 127 DEUZA RESENDE DE JESUS 413105 1 1
        # ANALISTA DE DEPARTAMENTO PESSOAL Admissão: 03/12/2024
        
        # Extrair CC (Centro de Custo)
        cc_match = re.search(r'CC:\s*([^\n]+)', text)
        cc = cc_match.group(1).strip() if cc_match else "Desconhecido"
        
        # Extrair código do funcionário
        code_match = re.search(r'(?:Código Nome do Funcionário|Filial\s*\n)\s*(\d+)\s+([A-ZÁÉÍÓÚ\s]+)\s+(\d+)\s+(\d+)\s+(\d+)', text)
        if not code_match:
            continue
            
        code = code_match.group(1)
        name = code_match.group(2).strip()
        cbo = code_match.group(3)
        dept = code_match.group(4)
        filial = code_match.group(5)
        
        # Extrair cargo (próxima linha após nome)
        role_match = re.search(rf'{name}\s+\d+\s+\d+\s+\d+\n\s*([A-ZÁÉÍÓÚ\s]+)\s+Admissão', text)
        role = role_match.group(1).strip() if role_match else "Sem cargo"
        
        # Extrair data de admissão
        hire_date_match = re.search(r'Admissão:\s*(\d{2}/\d{2}/\d{4})', text)
        hire_date = hire_date_match.group(1) if hire_date_match else "01/01/2025"
        
        def parse_value(value_str):
            """Converte string monetária para float"""
            if not value_str or not value_str.strip():
                return 0.0
            try:
                return float(value_str.replace('.', '').replace(',', '.'))
            except:
                return 0.0
        
        # Extrair salário base
        salary_match = re.search(r'Salário Base\s*[^\n]*\n\s*([\d.,]+)', text)
        salary = parse_value(salary_match.group(1)) if salary_match else 0
        
        # Extrair total de proventos
        total_prov_match = re.search(r'Total de Vencimentos\s*([\d.,]+)', text)
        total_provento = parse_value(total_prov_match.group(1)) if total_prov_match else 0
        
        # Extrair total de descontos
        total_desc_match = re.search(r'Total de Descontos\s*([\d.,]+)', text)
        total_desconto = parse_value(total_desc_match.group(1)) if total_desc_match else 0
        
        # Extrair valor líquido
        net_match = re.search(r'Valor Líquido\s*([\d.,]+)', text)
        net_pay = parse_value(net_match.group(1)) if net_match else 0
        
        # Extrair descontos (INSS, IRRF, adiantamento, vale transporte)
        inss_match = re.search(r'I\.N\.S\.S\.\s+[\d.,]*\s+([\d.,]+)', text)
        inss = parse_value(inss_match.group(1)) if inss_match else 0
        
        irrf_match = re.search(r'IMPOSTO DE RENDA\.\s+[\d.,]*\s+([\d.,]+)', text)
        irrf = parse_value(irrf_match.group(1)) if irrf_match else 0
        
        adiant_match = re.search(r'DESC\.ADIANT\.\s+SALARIAL\s+[\d.,]*\s+([\d.,]+)', text)
        adiantamento = parse_value(adiant_match.group(1)) if adiant_match else 0
        
        vale_match = re.search(r'VALE TRANSPORTE\s+[\d.,]*\s+([\d.,]+)', text)
        vale = parse_value(vale_match.group(1)) if vale_match else 0
        
        employee = {
            "codigo": code,
            "nome": name,
            "cargo": role,
            "cbo": cbo,
            "departamento": cc,
            "data_admissao": hire_date,
            "salario_base": salary,
            "total_proventos": total_provento,
            "inss": inss,
            "irrf": irrf,
            "adiantamento": adiantamento,
            "vale_transporte": vale,
            "total_descontos": total_desconto,
            "valor_liquido": net_pay,
            "tipo_contrato": "CLT",
            "ativo": True
        }
        
        employees_data.append(employee)
        print(f"✓ {name} ({code}) - R$ {salary:,.2f}")

print(f"\n\nTotal de funcionários encontrados: {len(employees_data)}")
print("\n" + "="*80)
print(json.dumps(employees_data, indent=2, ensure_ascii=False))

# Salvar em arquivo JSON
output_file = r'C:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1\funcionarios_extraidos.json'
with open(output_file, 'w', encoding='utf-8') as f:
    json.dump(employees_data, f, indent=2, ensure_ascii=False)

print(f"\n\nDados salvos em: {output_file}")
