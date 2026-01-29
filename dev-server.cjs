#!/usr/bin/env node
/**
 * Development API Server para NFS-e
 * Roda na porta 8082 enquanto Vite roda na 8080/8081
 */

// Carregar variáveis de ambiente
require('dotenv').config({ path: '.env.local' });
require('dotenv').config({ path: '.env' });

const express = require('express');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');

const app = express();
const PORT = 8082;

// Middleware
app.use(express.json());

// CORS para permitir chamada direta do Vite (5173)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Servir arquivos da pasta banco/ estaticamente (CSV/XLS)
app.use('/banco', express.static(path.resolve(__dirname, 'banco')));

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

// Parecer contábil Dr. Cícero
app.post('/closing/evaluate', async (req, res) => {
  const filePath = path.resolve(__dirname, './api/closing/evaluate.js');
  await handleApiRequest(filePath, req, res);
});

// API: Baixa de clientes (fonte banco) para conciliação de crédito por documento
function selectBaixaFileByDate(dateStr) {
  const bancoDir = path.resolve(__dirname, 'banco');
  const candidates = [];
  try {
    const d = dateStr ? new Date(String(dateStr)) : null;
    const m = d ? (d.getMonth() + 1) : null;
    // CSV nomeados por mês (preferência)
    if (m === 1 || m === null) candidates.push(path.join(bancoDir, 'clientes boletos jan.csv'));
    if (m === 2) candidates.push(path.join(bancoDir, 'clientes de boleto fev.csv'));
    // Excel genéricos que podem conter os títulos do período
    // Mantém lista ordenada por preferência
    candidates.push(path.join(bancoDir, 'relatorio dos titulos sicredi.xls'));
    candidates.push(path.join(bancoDir, 'relatorio do malote.xls'));
    candidates.push(path.join(bancoDir, 'honorarios recebidos em 02_2025.xlsx'));
  } catch {}
  const existing = candidates.filter((p) => fs.existsSync(p));
  return existing[0] || null;
}

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function parseBaixaCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const header = lines[0].split(';').map((p) => normalizeHeader(p));
  const idx = {
    documento: header.findIndex((h) => /documento/.test(h)),
    numeroboleto: header.findIndex((h) => /boleto/.test(h)),
    pagador: header.findIndex((h) => /pagador|sacado|cliente/.test(h)),
    dataVenc: header.findIndex((h) => /venc/i.test(h)),
    dataLiq: header.findIndex((h) => /liquid/i.test(h)),
    valorBol: header.findIndex((h) => /valor.*boleto/.test(h)),
    valorRec: header.findIndex((h) => /valor.*receb/.test(h)),
    dataExtr: header.findIndex((h) => /extrato/.test(h)),
  };
  const parseDateBR = (s) => {
    if (!s) return null;
    const [dd, mm, yyyy] = String(s).split('/');
    const d = Number(dd), m = Number(mm), y = Number(yyyy);
    const dt = new Date(y, m - 1, d);
    return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
  };
  const parseMoneyBR = (s) => {
    const cleaned = String(s).replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  };
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(';').map((p) => p.trim());
    if (!parts.length) continue;
    const row = {
      documento: idx.documento >= 0 ? parts[idx.documento] : parts[0],
      numeroboleto: idx.numeroboleto >= 0 ? parts[idx.numeroboleto] : undefined,
      pagador: idx.pagador >= 0 ? parts[idx.pagador] : undefined,
      dataVencimento: idx.dataVenc >= 0 ? parseDateBR(parts[idx.dataVenc]) : null,
      dataLiquidacao: idx.dataLiq >= 0 ? parseDateBR(parts[idx.dataLiq]) : null,
      valorBoleto: idx.valorBol >= 0 ? parseMoneyBR(parts[idx.valorBol]) : 0,
      valorRecebido: idx.valorRec >= 0 ? parseMoneyBR(parts[idx.valorRec]) : 0,
      dataExtrato: idx.dataExtr >= 0 ? parseDateBR(parts[idx.dataExtr]) : null,
    };
    out.push(row);
  }
  return out;
}

function parseBaixaExcel(filePath) {
  const wb = xlsx.readFile(filePath);
  // Procura primeira planilha que tenha linhas e cabeçalho
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
    if (!Array.isArray(rows) || rows.length < 2) continue;
    const header = (rows[0] || []).map((h) => normalizeHeader(h));
    const idx = {
      documento: header.findIndex((h) => /documento|doc\b/.test(h)),
      numeroboleto: header.findIndex((h) => /boleto|nosso numero|n.*boleto/.test(h)),
      pagador: header.findIndex((h) => /pagador|sacado|cliente/.test(h)),
      dataVenc: header.findIndex((h) => /venc/i.test(h)),
      dataLiq: header.findIndex((h) => /liquid/i.test(h)),
      valorBol: header.findIndex((h) => /valor.*boleto/.test(h)),
      valorRec: header.findIndex((h) => /valor.*receb/.test(h)),
      dataExtr: header.findIndex((h) => /extrato|credito/.test(h)),
    };
    const parseDateAny = (s) => {
      if (!s) return null;
      if (typeof s === 'number') {
        const d = xlsx.SSF ? xlsx.SSF.parse_date_code(s) : null;
        if (d) {
          const dt = new Date(d.y, d.m - 1, d.d);
          return dt.toISOString().slice(0, 10);
        }
      }
      // Tenta BR dd/mm/yyyy
      const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (m) {
        const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
      }
      // Fallback ISO
      try {
        const dt = new Date(String(s));
        return Number.isNaN(dt.getTime()) ? null : dt.toISOString().slice(0, 10);
      } catch { return null; }
    };
    const parseMoneyAny = (v) => {
      if (typeof v === 'number') return v;
      return parseFloat(String(v).replace(/\./g, '').replace(',', '.')) || 0;
    };
    const out = [];
    for (let i = 1; i < rows.length; i++) {
      const parts = rows[i] || [];
      const get = (ix) => (ix >= 0 ? parts[ix] : undefined);
      const row = {
        documento: get(idx.documento),
        numeroboleto: get(idx.numeroboleto),
        pagador: get(idx.pagador),
        dataVencimento: parseDateAny(get(idx.dataVenc)),
        dataLiquidacao: parseDateAny(get(idx.dataLiq)),
        valorBoleto: parseMoneyAny(get(idx.valorBol)),
        valorRecebido: parseMoneyAny(get(idx.valorRec)),
        dataExtrato: parseDateAny(get(idx.dataExtr)),
      };
      // Requer pelo menos documento e pagador
      if (row.documento && row.pagador) out.push(row);
    }
    if (out.length) return out;
  }
  return [];
}

app.get('/api/baixa-clientes', async (req, res) => {
  try {
    const { doc, date } = req.query;
    const debug = 'debug' in req.query;
    if (!doc) return res.status(400).json({ error: 'Parâmetro doc é obrigatório (ex.: COB000005 ou OB000005)' });

    const fileCandidates = [];

    // Escolha do arquivo baseado na data e disponibilidade (CSV/Excel)
    const filePath = selectBaixaFileByDate(date);
    if (filePath) fileCandidates.push(filePath);
    if (!filePath) {
      return res.status(404).json({ error: 'Arquivo de baixa não encontrado' });
    }
    const ext = path.extname(filePath).toLowerCase();
    let items = [];
    if (ext === '.csv') {
      const csv = fs.readFileSync(filePath, 'utf8');
      items = parseBaixaCSV(csv);
    } else if (ext === '.xls' || ext === '.xlsx') {
      items = parseBaixaExcel(filePath);
    } else {
      return res.status(415).json({ error: 'Formato de arquivo não suportado', source: filePath });
    }

    const normDoc = String(doc).toUpperCase(); // aceita COB000005 e OB000005
    const matchDoc = (dstr) => {
      const up = String(dstr).toUpperCase();
      // aceita [C]?OB000005 (com ou sem C inicial)
      const num = normDoc.replace(/^C?OB/, 'OB');
      return up.replace(/^C?OB/, 'OB') === num;
    };
    // Filtra documento
    items = items.filter((r) => matchDoc(r.documento));

    // Se "date" informada, filtra pela data de extrato exata (YYYY-MM-DD)
    let filtered = items;
    if (date) {
      const iso = new Date(String(date)).toISOString().slice(0, 10);
      filtered = items.filter((r) => r.dataExtrato === iso);
    }

    const total = filtered.reduce((s, r) => s + (Number(r.valorRecebido) || 0), 0);
    const payload = { doc, date, source: filePath, total, clientes: filtered };
    if (debug) {
      payload.debugInfo = { tried: fileCandidates, matchedCount: filtered.length, allCount: items.length };
    }
    console.log('baixa-clientes', { doc, date, source: filePath, matched: filtered.length, total });
    return res.json(payload);
  } catch (err) {
    console.error('Erro em /api/baixa-clientes:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: String((err && err.message) || err), stack: err && err.stack });
  }
});

// Alias sem prefixo "/api" (compatível com proxy do Vite que reescreve /api → /)
app.get('/baixa-clientes', async (req, res) => {
  try {
    const { doc, date } = req.query;
    const debug = 'debug' in req.query;
    if (!doc) return res.status(400).json({ error: 'Parâmetro doc é obrigatório (ex.: COB000005 ou OB000005)' });
    const fileCandidates = [];
    const filePath = selectBaixaFileByDate(date);
    if (filePath) fileCandidates.push(filePath);
    if (!filePath) return res.status(404).json({ error: 'Arquivo de baixa não encontrado' });

    const ext = path.extname(filePath).toLowerCase();
    let items = [];
    if (ext === '.csv') {
      const csv = fs.readFileSync(filePath, 'utf8');
      items = parseBaixaCSV(csv);
    } else if (ext === '.xls' || ext === '.xlsx') {
      items = parseBaixaExcel(filePath);
    } else {
      return res.status(415).json({ error: 'Formato de arquivo não suportado', source: filePath });
    }

    const normDoc = String(doc).toUpperCase();
    const matchDoc = (dstr) => String(dstr).toUpperCase().replace(/^C?OB/, 'OB') === normDoc.replace(/^C?OB/, 'OB');
    items = items.filter((r) => matchDoc(r.documento));

    let filtered = items;
    if (date) {
      const iso = new Date(String(date)).toISOString().slice(0, 10);
      filtered = items.filter((r) => r.dataExtrato === iso);
    }
    const total = filtered.reduce((s, r) => s + (Number(r.valorRecebido) || 0), 0);
    const payload = { doc, date, source: filePath, total, clientes: filtered };
    if (debug) payload.debugInfo = { tried: fileCandidates, matchedCount: filtered.length, allCount: items.length };
    console.log('baixa-clientes (alias)', { doc, date, source: filePath, matched: filtered.length, total });
    return res.json(payload);
  } catch (err) {
    console.error('Erro em /baixa-clientes:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json({ error: String(err && err.message || err) });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

const http = require('http');

// Fallback para SPA - proxy reverso para o Vite para todas as rotas que não são API
// Detecta porta dinamicamente (Vite tenta 5173 por padrão e auto-incrementa em caso de conflito)
const VITE_PORT_ENV = process.env.VITE_DEV_PORT || process.env.VITE_PORT;
let detectedVitePort = VITE_PORT_ENV ? Number(VITE_PORT_ENV) : null;

async function probePortOnce(port) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/', method: 'HEAD' }, (resProbe) => {
      resolve(resProbe.statusCode && resProbe.statusCode < 600);
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function findVitePort() {
  if (detectedVitePort) return detectedVitePort;
  const candidates = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 8080];
  for (const port of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await probePortOnce(port);
    if (ok) {
      detectedVitePort = port;
      console.log(`🔎 Vite detectado na porta ${detectedVitePort}`);
      break;
    }
  }
  return detectedVitePort;
}

app.use(async (req, res, next) => {
  // Se a requisição é para uma rota que não é API, faz proxy para o Vite
  const isApi = req.path.startsWith('/nfse') || req.path.startsWith('/health') || req.path.startsWith('/api') || req.path.startsWith('/baixa-clientes');
  if (isApi) return next();

  const vitePort = await findVitePort();
  if (!vitePort) {
    console.error('❌ Vite não encontrado em 5173-5179. Certifique-se de que o Vite está rodando.');
    return res.status(502).send('Bad Gateway - Vite não está rodando (5173-5179).');
  }

  console.log(`🔄 Proxy para Vite:${vitePort} -> ${req.method} ${req.path}`);

  const proxyReq = http.request(
    {
      hostname: '127.0.0.1',
      port: vitePort,
      path: req.url,
      method: req.method,
      headers: req.headers,
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    }
  );

  proxyReq.on('error', async (err) => {
    console.error(`❌ Erro ao fazer proxy para Vite:${vitePort}:`, err.message);
    // Em caso de erro, tenta redetectar a porta uma vez e reenviar
    detectedVitePort = null;
    const retryPort = await findVitePort();
    if (retryPort && retryPort !== vitePort) {
      console.log(`🔁 Reencaminhando para Vite:${retryPort}`);
      const retryReq = http.request(
        {
          hostname: '127.0.0.1',
          port: retryPort,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (retryRes) => {
          res.writeHead(retryRes.statusCode, retryRes.headers);
          retryRes.pipe(res);
        }
      );
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        req.pipe(retryReq);
      } else {
        retryReq.end();
      }
      return;
    }
    res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end(`Bad Gateway - Vite não respondeu. Erro: ${err.message}`);
  });

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    req.pipe(proxyReq);
  } else {
    proxyReq.end();
  }
});

// Middleware global de erro para sempre responder JSON nas rotas da API
app.use((err, req, res, next) => {
  try {
    console.error('❌ Erro não tratado:', err && err.message, err && err.stack);
    if (res.headersSent) return next(err);
    res.status(500);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: String(err && err.message || err), stack: err && err.stack }));
  } catch (e) {
    try {
      res.status(500).setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Erro ao formatar erro', details: String(e && e.message || e) }));
    } catch (_) {
      // Silencia último recurso
    }
  }
});

// Iniciar servidor
app.listen(PORT, '::', () => {
  console.log(`\n✅ API Server rodando em http://127.0.0.1:${PORT}`);
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

// Mantém o processo vivo mesmo que não haja outras referências (workaround para ambientes que encerram o processo)
setInterval(() => {}, 1 << 30);

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

