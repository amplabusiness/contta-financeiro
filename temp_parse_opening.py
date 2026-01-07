
import re

def parse_money(val):
    if not val: return 0.0
    clean = val.replace('R$', '').replace('.', '').replace(',', '.').strip()
    if clean == '-': return 0.0
    return float(clean)

def main():
    with open('_raw_opening_balances.txt', 'r', encoding='utf-8') as f:
        lines = [l.strip() for l in f.readlines() if l.strip()]

    # Skip header lines until we find the start of the table data
    # "Todos os clientes" usually marks the start of the detailed list
    start_index = 0
    for i, line in enumerate(lines):
        if line == 'Todos os clientes':
            start_index = i + 1
            break
    
    # Header of table is: Cliente Competência Vencimento Valor Pago Status Ações
    # But text is flat. Let's look for the pattern.
    
    data_lines = lines[start_index:]
    
    # We need to iterate. The pattern based on the text sample is:
    # 1. Client Name
    # 2. Competence (MM/YYYY)
    # 3. Reference Row (Due Date + Amount + Paid + Status)
    
    # However, sometimes Client Name is repeated or not?
    # Looking at the sample:
    # CLIENT NAME
    # MM/YYYY
    # ROW DATA
    
    entries = []
    
    i = 0
    current_entries = []
    
    # Try to identify blocks
    while i < len(data_lines):
        # Heuristic: A line is likely a client name if it's NOT a date and NOT a money value
        # But "Competência" looks like MM/YYYY.
        
        # Let's simple consume 3 lines at a time if they fit the pattern
        # Line A: Client Name (String)
        # Line B: Competence (MM/YYYY)
        # Line C: Data Row (Date R$ ...)
        
        # Verify if Line B matches MM/YYYY
        if i+2 < len(data_lines):
            line_a = data_lines[i]
            line_b = data_lines[i+1]
            line_c = data_lines[i+2]
            
            if re.match(r'^\d{2}/\d{4}$', line_b):
                # Found a block
                entry = {
                    'client': line_a,
                    'competence': line_b,
                    'details': line_c
                }
                current_entries.append(entry)
                i += 3
                continue
        
        # If not match, advance 1
        i += 1

    sql_statements = []
    sql_statements.append("-- Script gerado para popular client_opening_balance")
    sql_statements.append("-- Baseado em _raw_opening_balances.txt")
    sql_statements.append("BEGIN;")
    
    for entry in current_entries:
        client_name = entry['client']
        competence = entry['competence']
        details = entry['details']
        
        # Parse details line which is tab separated or space separated in the raw text provided
        # The user pasted it, it might have tabs or spaces. The prompt format shows tabs/large spaces.
        # "09/01/2026 R$ 1.412,00 - Pendente"
        
        # Split by "R$" to help
        parts = details.split('R$')
        
        due_date_raw = parts[0].strip() # "09/01/2026"
        
        # Extract Amount
        # parts[1] starts with amount. " 1.412,00 - Pendente" or " 1.412,00 R$ 1.000,00 Pago"
        
        # Re-tokenizing strategy
        # Tokenize by tab if possible, but the file read keeps lines separate.
        # The sample shows: "09/01/2026\tR$ 1.412,00\t-\tPendente" roughly
        # Let's rely on regex to find the first Date and the Amounts
        
        date_match = re.search(r'\d{2}/\d{2}/\d{4}', details)
        due_date = date_match.group(0) if date_match else None
        
        amounts = re.findall(r'R\$\s*[\d\.,]+', details)
        
        amount = 0.0
        paid = 0.0
        
        if len(amounts) >= 1:
            amount = parse_money(amounts[0])
        if len(amounts) >= 2:
            paid = parse_money(amounts[1])
            
        status = 'pending'
        if 'Pago' in details:
            status = 'paid'
            if paid == 0 and amount > 0:
                paid = amount # Assume full payment if marked Paid but no second amount? 
                # Actually usually "Pago" has 2 amounts equal.
        elif 'Pendente' in details:
            status = 'pending'
            
        
        if due_date:
            # Convert date to YYYY-MM-DD
            d, m, y = due_date.split('/')
            sql_due_date = f"{y}-{m}-{d}"
        else:
            sql_due_date = 'NULL'
            
        # Check integrity
        # competences > Jan 2026 might be ignored or inserted? 
        # The prompt implies these are "Saldos de Abertura".
        
        # Cleaning client name
        # Some have "60.489.571 MONICA..." -> Remove numeric prefix?
        # Supabase lookup should be robust.
        
        # SQL
        # We use a DO block or simple INSERTs with subselects
        
        # Escape single quotes in client name
        safe_client_name = client_name.replace("'", "''")
        
        sql = f"""
        INSERT INTO client_opening_balance (client_id, competence, amount, due_date, status, paid_amount, description)
        SELECT 
            id, 
            '{competence}', 
            {amount}, 
            '{sql_due_date}', 
            '{status}', 
            {paid}, 
            'Saldo de Abertura Importado'
        FROM clients 
        WHERE name ILIKE '{safe_client_name}%'
        OR name ILIKE '%{safe_client_name}%'
        LIMIT 1;
        """
        sql_statements.append(sql.strip())

    sql_statements.append("COMMIT;")
    
    with open('populate_opening_balances.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_statements))
    
    print(f"Generated {len(current_entries)} entries.")

if __name__ == '__main__':
    main()
