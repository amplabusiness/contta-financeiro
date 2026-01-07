
import fs from 'fs';
const rawData = fs.readFileSync('_sistema_entries.json', 'utf8');
const entries = JSON.parse(rawData);
console.log(Object.keys(entries[0]));
console.log(entries[0]);
