import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = path.resolve(__dirname, '../src');

const PROHIBITED_PATTERNS = [
  /mockReturnValue/,
  /mockResolvedValue/,
  /vi\.fn\(/,
  /jest\.fn\(/,
  /faker\./,
];

const SUSPICIOUS_PATTERNS = [
  /fetch\(['"]\.+.*csv['"]\)/, // Local CSV fetches
  /fetch\(['"]\/.*csv['"]\)/,
];

let hasErrors = false;

const EXCLUDED_FILES_FOR_IMPORT = [
  'ClientComparisonVerification.tsx',
  'ClientSpreadsheetVerification.tsx',
  'ClientVerification.tsx',
  'InactiveClientVerification.tsx',
];

function scanDir(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDir(fullPath);
    } else {
      if (EXCLUDED_FILES_FOR_IMPORT.includes(file)) {
        console.log(`[WARN] Skipping import/verification tool: ${file}`);
        continue;
      }

      if (file.match(/\.(test|spec)\.(ts|js|tsx|jsx)$/)) {
        console.error(`[ERROR] Test file found in production source: ${fullPath}`);
        hasErrors = true;
      }

      // Read file content and check patterns
      // Skip if file is too large or binary (simple check)
      if (stat.size > 1000000) continue; 
      
      try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          
          for (const pattern of PROHIBITED_PATTERNS) {
            if (pattern.test(content)) {
              console.error(`[ERROR] Prohibited mock pattern ${pattern} found in: ${fullPath}`);
              hasErrors = true;
            }
          }

          for (const pattern of SUSPICIOUS_PATTERNS) {
            if (pattern.test(content)) {
              console.error(`[ERROR] Non-database data source detected (CSV fetch): ${fullPath}`);
              hasErrors = true;
            }
          }
      } catch (e) {
          // ignore read errors
      }
    }
  }
}

console.log('Scanning for mocks and non-production artifacts...');
if (fs.existsSync(rootDir)) {
    scanDir(rootDir);
} else {
    console.error(`Source directory not found: ${rootDir}`);
    process.exit(1);
}

if (hasErrors) {
  console.error('FAILED: Mocks or non-production code detected.');
  process.exit(1);
} else {
  console.log('PASSED: No mocks detected.');
}
