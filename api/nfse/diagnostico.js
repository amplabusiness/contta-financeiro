import { createClient } from '@supabase/supabase-js';
import forge from 'node-forge';
import { loadCertificateFromEnv } from '../_shared/nfse-abrasf204.js';

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
}

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization;
  if (!header) return null;
  const match = String(header).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

function readCommonName(attrs) {
  const cn = (attrs || []).find((a) => a?.shortName === 'CN' || a?.name === 'commonName');
  return cn?.value || null;
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end('ok');
    return;
  }

  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.json({ error: 'Method not allowed' });
    return;
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      res.statusCode = 401;
      res.json({ error: 'Authorization Bearer token obrigatório' });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const envStatus = {
      SUPABASE_URL: !!supabaseUrl,
      SUPABASE_SERVICE_ROLE_KEY: !!serviceRoleKey,
      NFSE_CERT_PFX_B64: !!process.env.NFSE_CERT_PFX_B64,
      NFSE_CERT_PASSWORD: !!process.env.NFSE_CERT_PASSWORD,
    };

    if (!supabaseUrl || !serviceRoleKey) {
      res.statusCode = 500;
      res.json({ ok: false, error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados no servidor', env: envStatus });
      return;
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      res.statusCode = 401;
      res.json({ ok: false, error: 'Token inválido', env: envStatus });
      return;
    }

    // Carregar e parsear certificado (sem expor chaves/segredos)
    const { certBase64 } = loadCertificateFromEnv();
    const derBytes = forge.util.decode64(certBase64);
    const asn1Obj = forge.asn1.fromDer(derBytes);
    const cert = forge.pki.certificateFromAsn1(asn1Obj);

    const subjectCN = readCommonName(cert.subject?.attributes);
    const issuerCN = readCommonName(cert.issuer?.attributes);
    const notBefore = cert.validity?.notBefore ? new Date(cert.validity.notBefore).toISOString() : null;
    const notAfter = cert.validity?.notAfter ? new Date(cert.validity.notAfter).toISOString() : null;

    res.statusCode = 200;
    res.json({
      ok: true,
      env: envStatus,
      cert: {
        subjectCN,
        issuerCN,
        notBefore,
        notAfter,
      },
    });
  } catch (err) {
    res.statusCode = 500;
    res.json({ ok: false, error: err?.message || String(err) });
  }
}
