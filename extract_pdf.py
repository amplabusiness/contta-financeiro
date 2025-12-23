import pdfplumber
import json

pdf_path = r'C:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1\folha_pgto\FOLHA AMPLA JAN.pdf'

with pdfplumber.open(pdf_path) as pdf:
    print(f"Total de páginas: {len(pdf.pages)}\n")
    
    for i, page in enumerate(pdf.pages):
        print(f"=== PÁGINA {i+1} ===")
        text = page.extract_text()
        print(text)
        print("\n")
        
        # Tentar extrair tabelas
        tables = page.extract_tables()
        if tables:
            print(f"Tabelas encontradas: {len(tables)}")
            for j, table in enumerate(tables):
                print(f"\nTabela {j+1}:")
                for row in table[:10]:  # Primeiras 10 linhas
                    print(row)
