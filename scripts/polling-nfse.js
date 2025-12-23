#!/usr/bin/env node
/**
 * Job de Polling para Consultar Status de NFS-e
 * Executa a cada 5 minutos para verificar se há NFS-e em processamento
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const POLL_INTERVAL = 5 * 60 * 1000; // 5 minutos

async function consultarStatus() {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'consultar-status.js');
    const process = spawn('node', [scriptPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: path.join(__dirname, '..')
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => { stdout += data; });
    process.stderr.on('data', (data) => { stderr += data; });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({ output: stdout, success: true });
      } else {
        reject(new Error(stderr || 'Script falhou'));
      }
    });

    process.on('error', reject);
  });
}

async function startPolling() {
  console.log('🚀 Iniciando polling de NFS-e');
  console.log(`⏰ Consultando status a cada ${POLL_INTERVAL / 1000 / 60} minutos`);
  console.log('');

  // Executar imediatamente na inicialização
  await executarConsulta();

  // Depois, executar periodicamente
  setInterval(executarConsulta, POLL_INTERVAL);
}

async function executarConsulta() {
  const horario = new Date().toLocaleString('pt-BR');
  console.log(`[${horario}] 🔍 Consultando status de NFS-e...`);

  try {
    const result = await consultarStatus();
    console.log(result.output);
  } catch (error) {
    console.error(`  ❌ Erro: ${error.message}`);
  }
  console.log('');
}

// Iniciar
startPolling().catch(err => {
  console.error('❌ Erro ao iniciar polling:', err);
  process.exit(1);
});

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n👋 Polling encerrado');
  process.exit(0);
});
