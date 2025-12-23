# Setup Completo NFS-e - Ampla

**Tudo o que você precisa fazer em um comando:**

```powershell
cd C:\Users\ampla\OneDrive\Documentos\financeiro\data-bling-sheets-3122699b-1
.\scripts\setup-nfse-complete.ps1
```

**O script vai:**

1. ✓ Procurar automaticamente o PFX (ou pedir o caminho)
2. ✓ Solicitar Supabase URL (você copia do dashboard)
3. ✓ Solicitar Service Role Key (você copia do dashboard > API Keys)
4. ✓ Solicitar senha do PFX (sem aparecer no terminal)
5. ✓ Validar certificado (CN, validade, etc.)
6. ✓ Configurar variáveis de ambiente
7. ✓ Subir o dev server (Vite + /api com mTLS)
8. ✓ Abrir navegador na tela de NFS-e automaticamente

---

## Onde encontrar as credenciais Supabase?

1. **URL**: Vá para https://app.supabase.com → Project → Home
   - Procure por "Project URL" (começa com `https://`)

2. **Service Role Key**: Mesmo projeto → Settings → API
   - Clique em "Service role secret" (marque "Hide" se quiser colar)
   - Copy a chave (começa com `eyJ...` e é longa)

---

## Onde está o PFX?

- Se você tiver em `C:\certificado\ampla.pfx` → o script acha automaticamente
- Se estiver em outro lugar → o script pede o caminho completo
- Pode estar em `Desktop`, `Downloads`, ou `Documents`

---

## Depois que subir:

1. Navegador abre na tela de NFS-e
2. Selecione **dezembro/2025** no filtro
3. Clique em um cliente na "Emissão Rápida"
4. Veja o resultado (protocolo ou erro)

Se houver erro, eu ajudo a diagnosticar!
