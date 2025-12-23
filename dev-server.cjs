#!/usr/bin/env node
/**
 * Development API Server para NFS-e
 * Roda na porta 8082 enquanto Vite roda na 8080/8081
 */
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8082;

// Middleware
app.use(express.json());

// Log de requisições
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Handler genérico para endpoints de API
const handleApiRequest = async (filePath, req, res) => {
  try {
    if (!fs.existsSync(filePath)) {
      console.error(`❌ Arquivo não encontrado: ${filePath}`);
      return res.status(404).json({ error: 'Endpoint não encontrado', path: filePath });
    }
    
    // Converter path para URL file:// para Windows
    const fileUrl = 'file://' + path.resolve(filePath).replace(/\\/g, '/');
    console.log(`📤 Importando ${fileUrl}`);
    
    // Usar import dinâmico para ES6 modules
    const handler = (await import(fileUrl)).default;
    
    if (typeof handler !== 'function') {
      console.error(`❌ Handler não é função. Tipo: ${typeof handler}`);
      return res.status(500).json({ error: 'Handler não é uma função', type: typeof handler });
    }
    
    // Executar handler
    console.log(`📤 Executando handler`);
    await handler(req, res);
  } catch (error) {
    console.error(`❌ Erro ao processar requisição:`, error.message);
    console.error(error.stack);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: error.message,
        details: error.stack
      });
    }
  }
};

// Rotas de API
app.post('/nfse/emitir', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/emitir.js');
  await handleApiRequest(filePath, req, res);
});

app.post('/nfse/consultar', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/consultar.js');
  await handleApiRequest(filePath, req, res);
});

app.get('/nfse/diagnostico', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/diagnostico.js');
  await handleApiRequest(filePath, req, res);
});

app.get('/nfse/consultar-status', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/consultar-status.js');
  await handleApiRequest(filePath, req, res);
});

app.post('/nfse/consultar-status', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/consultar-status.js');
  await handleApiRequest(filePath, req, res);
});

// Consultar Lote RPS
app.post('/nfse/consultar-lote', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/consultar-lote.js');
  await handleApiRequest(filePath, req, res);
});

app.get('/nfse/consultar-lote', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/consultar-lote.js');
  await handleApiRequest(filePath, req, res);
});

// Serviços Prestados (notas emitidas)
app.post('/nfse/servicos-prestados', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/servicos-prestados.js');
  await handleApiRequest(filePath, req, res);
});

app.get('/nfse/servicos-prestados', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/servicos-prestados.js');
  await handleApiRequest(filePath, req, res);
});

// Serviços Tomados (notas recebidas - despesas)
app.post('/nfse/servicos-tomados', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/servicos-tomados.js');
  await handleApiRequest(filePath, req, res);
});

app.get('/nfse/servicos-tomados', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/servicos-tomados.js');
  await handleApiRequest(filePath, req, res);
});

// Cancelar NFS-e
app.post('/nfse/cancelar', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/cancelar.js');
  await handleApiRequest(filePath, req, res);
});

// Importar XMLs de NFS-e tomadas
app.post('/nfse/importar-xml', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/nfse/importar-xml.js');
  await handleApiRequest(filePath, req, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n✅ API Server rodando em http://localhost:${PORT}`);
  console.log(`📍 Endpoints NFS-e:`);
  console.log(`   POST /nfse/emitir              - Emitir NFS-e`);
  console.log(`   POST /nfse/consultar           - Consultar NFS-e por RPS`);
  console.log(`   POST /nfse/consultar-lote      - Consultar resultado do lote`);
  console.log(`   POST /nfse/servicos-prestados  - Consultar notas emitidas`);
  console.log(`   POST /nfse/servicos-tomados    - Consultar notas recebidas (despesas)`);
  console.log(`   POST /nfse/cancelar            - Cancelar NFS-e`);
  console.log(`   POST /nfse/importar-xml        - Importar XMLs de NFS-e tomadas`);
  console.log(`   GET  /nfse/diagnostico         - Diagnóstico do sistema`);
  console.log(`   GET  /health                   - Health check`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

