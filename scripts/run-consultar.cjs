#!/usr/bin/env node
// Script CommonJS para carregar .env e executar consultar-status.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Carregar .env
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');

const env = { ...process.env };
envContent.split('\n').forEach(line => {
  // Ignorar linhas vazias e comentários
  if (!line.trim() || line.trim().startsWith('#')) return;

  const eqIdx = line.indexOf('=');
  if (eqIdx === -1) return;

  const key = line.slice(0, eqIdx).trim();
  let value = line.slice(eqIdx + 1).trim();

  // Remover aspas
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    value = value.slice(1, -1);
  }

  env[key] = value;
});

console.log('🔧 Variáveis carregadas do .env');
console.log('   SUPABASE_URL:', env.SUPABASE_URL ? '✅' : '❌');
console.log('   SUPABASE_SERVICE_ROLE_KEY:', env.SUPABASE_SERVICE_ROLE_KEY ? '✅' : '❌');
console.log('   NFSE_CERT_PFX_B64:', env.NFSE_CERT_PFX_B64 ? '✅ (' + env.NFSE_CERT_PFX_B64.length + ' chars)' : '❌');
console.log('   NFSE_CERT_PASSWORD:', env.NFSE_CERT_PASSWORD ? '✅' : '❌');
console.log('');

// Executar o script ES module
try {
  execSync('node scripts/consultar-status.js', {
    cwd: path.join(__dirname, '..'),
    env,
    stdio: 'inherit'
  });
} catch (err) {
  process.exit(err.status || 1);
}
