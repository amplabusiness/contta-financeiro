"""
Extrator de Fichas de Empregado PDF
Dr. Cícero - Contador Responsável
"""

import pdfplumber
import json
import re

def extrair_funcionario(text):
    """Extrai dados de um funcionário do texto da ficha"""
    func = {}
    
    # Nome - logo após 'Empregado Beneficiários'
    match = re.search(r'Empregado Beneficiários\s*\n([A-Z\s]+?)(?:\n|Residência)', text)
    if match:
        nome = match.group(1).strip()
        nome = nome.split('\n')[0].strip()
        func['name'] = nome
    
    # CPF - formato XXX.XXX.XXX-XX
    match = re.search(r'(\d{3}\.\d{3}\.\d{3}-\d{2})', text)
    if match:
        func['cpf'] = match.group(1)
    
    # Data nascimento
    match = re.search(r'Data de nascimento.*?(\d{2}/\d{2}/\d{4})', text)
    if match:
        d = match.group(1).split('/')
        func['birth_date'] = f'{d[2]}-{d[1]}-{d[0]}'
    
    # Cargo e CBO
    match = re.search(r'Cargo Função C\.B\.O\.\s*\n(.+?)\s+(\d{6})', text)
    if match:
        func['role'] = match.group(1).strip()
        func['cbo'] = match.group(2)
    
    # Data de admissão e salário
    match = re.search(r'Data de Admissão Salário.*?\n(\d{2}/\d{2}/\d{4})\s+R\$\s*([\d\.,]+)', text)
    if match:
        d = match.group(1).split('/')
        func['hire_date'] = f'{d[2]}-{d[1]}-{d[0]}'
        salario = match.group(2).replace('.', '').replace(',', '.')
        func['official_salary'] = float(salario)
    
    # Último salário (alterações) - pega o mais recente
    matches = re.findall(r'Em \d{2}/\d{2}/\d{4} R\$\s*([\d\.,]+)', text)
    if matches:
        ultimo = matches[-1].replace('.', '').replace(',', '.')
        func['official_salary'] = float(ultimo)
    
    # Data de saída (demissão)
    match = re.search(r'Data da saída:\s*(\d{2}/\d{2}/\d{4})', text)
    if match:
        d = match.group(1).split('/')
        func['termination_date'] = f'{d[2]}-{d[1]}-{d[0]}'
    
    return func if 'name' in func else None

def extrair_fichas(pdf_path, status='ativo'):
    funcionarios = []
    
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text or 'REGISTRO DE EMPREGADO' not in text:
                continue
            
            func = extrair_funcionario(text)
            if func:
                func['status'] = status
                funcionarios.append(func)
    
    return funcionarios

if __name__ == '__main__':
    # Extrair ATIVOS
    print('Extraindo ATIVOS...')
    ativos = extrair_fichas('folha_pgto/Ficha de Empregado ATIVOS.pdf', 'ativo')
    print(f'  Encontrados: {len(ativos)}')

    # Extrair DEMITIDOS
    print('Extraindo DEMITIDOS...')
    demitidos = extrair_fichas('folha_pgto/Ficha de Empregado DEMITIDOS.pdf', 'demitido')
    print(f'  Encontrados: {len(demitidos)}')

    # Juntar todos
    todos = ativos + demitidos

    # Salvar JSON
    with open('funcionarios_fichas_empregado.json', 'w', encoding='utf-8') as f:
        json.dump(todos, f, indent=2, ensure_ascii=False)

    print(f'\nTotal: {len(todos)} funcionários')
    print('Salvo em: funcionarios_fichas_empregado.json')

    # Mostrar resumo
    print('\n' + '='*90)
    print('FUNCIONÁRIOS EXTRAÍDOS:')
    print('='*90)
    print(f"{'Nome':<36} {'CPF':<16} {'Admissão':<12} {'Salário':>12} {'Status'}")
    print('-'*90)
    for f in sorted(todos, key=lambda x: x.get('name', '')):
        nome = f.get('name', '?')[:35]
        cpf = f.get('cpf', '-')
        adm = f.get('hire_date', '-')
        sal = f.get('official_salary', 0)
        status = f.get('status', '-')
        print(f"{nome:<36} {cpf:<16} {adm:<12} R$ {sal:>9,.2f} {status}")
