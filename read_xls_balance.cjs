
const xlsx = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'banco', 'extrato 12-2024 A 11-2025.xls');

try {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert to JSON to inspect
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    
    console.log("Rows found: " + data.length);
    
    // Print first few rows to understand structure
    console.log("Header/First Rows:");
    data.slice(0, 15).forEach((row, i) => console.log(i, row));

    // Look for rows with dates 31/12/2024 or 01/01/2025
    console.log("\nSearching for End of Dec / Start of Jan...");
    
    // Helper to format date if it's a number (Excel date)
    const fmt = (val) => val; 

    data.forEach((row, index) => {
        const date = row[0];
        if (typeof date === 'string') {
            if (date.includes('/12/2024') || date.includes('/01/2025')) {
                // Keep keeping track of the last balance seen for Dec and Jan
            }
        }
    });

    // Filter for end of Dec and End of Jan
    const decRows = data.filter(r => r[0] && r[0].includes && r[0].includes('/12/2024'));
    const janRows = data.filter(r => r[0] && r[0].includes && r[0].includes('/01/2025'));
    
    if (decRows.length > 0) {
        const lastDec = decRows[decRows.length - 1];
        console.log("LAST DEC 2024 ROW:", lastDec);
    }
    
    if (janRows.length > 0) {
        const lastJan = janRows[janRows.length - 1];
        console.log("LAST JAN 2025 ROW:", lastJan);
    }
} catch (e) {
    console.error("Error reading XLS:", e.message);
}
