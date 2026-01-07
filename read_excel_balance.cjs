
const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(__dirname, 'banco', 'extrato 12-2024 A 11-2025.xls');

if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
}

try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }); // Array of arrays

    console.log(`Successfully read "${filePath}". Sheet: "${sheetName}"`);
    console.log(`Total rows: ${data.length}`);

    // Helper to parse DD/MM/YYYY
    const parseDate = (dateStr) => {
        if (!dateStr || typeof dateStr !== 'string') return null;
        const parts = dateStr.split('/');
        if (parts.length !== 3) return null;
        // month is 0-indexed in JS Date
        return new Date(parts[2], parts[1] - 1, parts[0]);
    };

    // Dictionary to store the LAST balance seen for each month
    // Key: "YYYY-MM" -> Value: Number
    const monthlyClosings = {};

    console.log("Analyzing monthly balances...");

    // Basic heuristic: Process row by row. 
    // If it has a date and a balance, update the entry for that month.
    // The last row processed for a given month will naturally hold the closing balance.
    // Column Index Mapping based on previous run:
    // 0: Data, 1: Desc, 2: Doc, 3: Valor, 4: Saldo
    
    // Skip header (row 0)
    console.log("Checking December 2025 entries...");
    let dec25Count = 0;
    
    for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 5) continue;

        const dateStr = row[0];
        const balance = row[4];
        
        if (dateStr && typeof dateStr === 'string' && dateStr.includes('/12/2025')) {
            dec25Count++;
            if (dec25Count <= 3) {
                console.log(`Row ${i}:`, row);
            }
        }


        if (dateStr && (typeof balance === 'number' || !isNaN(parseFloat(balance)))) {
             const date = parseDate(dateStr);
             if (date && !isNaN(date.getTime())) {
                 const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                 monthlyClosings[key] = parseFloat(balance);
             }
        }
    }

    console.log("\n--- DETECTED MONTHLY CLOSING BALANCES ---");
    const sortedKeys = Object.keys(monthlyClosings).sort();
    
    // We also need the starting balance of the very first month found, 
    // although typically Start(Month N) == End(Month N-1).
    // Let's print the code structure directly.

    console.log("const LOCKED_BALANCES: Record<string, { start: number, end: number }> = {");
    
    sortedKeys.forEach((key, index) => {
        const closingBalance = monthlyClosings[key];
        
        // Start balance logic:
        // For the first month in our list, we don't know the start unless we assume it's the 
        // end of the previous one (which we might not have) or we find the very first row of that month.
        // But for this requirement, we can chain them.
        
        let startBalance = 0;
        
        if (index === 0) {
            // Special case first month found (Dec 2024 probably).
            // We'll try to find the first transaction of this month to deduce start, 
            // OR just use a placeholder if it's the very beginning.
            // Actually, for Dec 2024, let's look for Nov 2024 closing? 
            // If not found, we might need a manual input or just accept we fix "Ends".
            // Since User said "Start Jan 2025 is End Dec 2024", we really focus on the chain.
            
            // Let's just print the end balances we found, effectively.
        } else {
            startBalance = monthlyClosings[sortedKeys[index - 1]];
        }
        
        // We will output in a format ready to copy, assuming chain continuity
        // Format: 'YYYY-MM': { start: PREV_END, end: CURR_END },
        
        // Skip the very first one IF we don't have a previous one? 
        // No, let's print it, maybe with start: 0 or explicit check.
        
        if (index > 0) {
           console.log(`    '${key}': { start: ${startBalance.toFixed(2)}, end: ${closingBalance.toFixed(2)} },`); 
        } else {
           // First item (e.g., 2024-12). We don't have 2024-11 end.
           // Let's just log it as a comment or partial.
           console.log(`    '${key}': { start: 0, end: ${closingBalance.toFixed(2)} }, // Start unknown/manual`);
        }
    });
    console.log("};");
    
} catch (error) {
    console.error("Error reading excel:", error.message);
}
