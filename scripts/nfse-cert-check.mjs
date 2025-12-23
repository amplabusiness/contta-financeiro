import forge from 'node-forge';
import { loadCertificateFromEnv } from '../api/_shared/nfse-abrasf204.js';

function readCommonName(attrs) {
  const cn = (attrs || []).find((a) => a?.shortName === 'CN' || a?.name === 'commonName');
  return cn?.value || null;
}

try {
  const { certBase64 } = loadCertificateFromEnv();
  const derBytes = forge.util.decode64(certBase64);
  const asn1Obj = forge.asn1.fromDer(derBytes);
  const cert = forge.pki.certificateFromAsn1(asn1Obj);

  const subjectCN = readCommonName(cert.subject?.attributes);
  const issuerCN = readCommonName(cert.issuer?.attributes);
  const notBefore = cert.validity?.notBefore ? new Date(cert.validity.notBefore).toISOString() : null;
  const notAfter = cert.validity?.notAfter ? new Date(cert.validity.notAfter).toISOString() : null;

  console.log(JSON.stringify({ ok: true, cert: { subjectCN, issuerCN, notBefore, notAfter } }, null, 2));
} catch (err) {
  console.error(JSON.stringify({ ok: false, error: err?.message || String(err) }, null, 2));
  process.exit(1);
}
