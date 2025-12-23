# NFS-e Polling Job

## Descrição

O sistema NFS-e agora inclui um **job de polling automático** que monitora o status das notas fiscais em processamento e as atualiza quando forem aprovadas pela prefeitura.

## Como Funciona

1. **Emissão**: Quando você emite uma NFS-e, ela fica com status `processing` e um protocolo é gerado
2. **Polling**: A cada 5 minutos, o job consulta o webservice municipal para saber se a NFS-e foi aprovada
3. **Atualização**: Quando aprovada, o sistema salva:
   - Status: `approved`
   - Número da NFS-e (numero_nfse)
   - Código de Verificação (codigo_verificacao)

## Usar em Desenvolvimento

### Terminal 1: API Server
```bash
cd data-bling-sheets-3122699b-1
# Carregar .env e iniciar API
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
node ./dev-server.cjs
```

### Terminal 2: Frontend (Vite)
```bash
cd data-bling-sheets-3122699b-1
npm run dev
```

### Terminal 3: Polling Job (Novo!)
```bash
cd data-bling-sheets-3122699b-1
# Carregar .env novamente
Get-Content .env | ForEach-Object { if ($_ -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
npm run nfse:polling
```

## Fluxo Completo

```
┌─────────────────────┐
│  Você Emite NFS-e   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────┐
│ Sistema cria registro           │
│ Status: "processing"            │
│ Protocolo: gerado               │
└──────────┬──────────────────────┘
           │
           │ (Envia para prefeitura)
           │
    ┌──────▼───────┐
    │ A cada 5 min │
    └──────┬───────┘
           │
           ▼
┌──────────────────────┐
│ Polling Job Executa  │
│ Consulta webservice  │
└──────────┬───────────┘
           │
      ┌────┴────┐
      │          │
      ▼          ▼
   Aprovada   Processando
      │          │
      │          └─ Aguarda próximo ciclo
      │
      ▼
┌─────────────────────────────┐
│ Sistema atualiza registro   │
│ Status: "approved"          │
│ numero_nfse: gerado         │
│ codigo_verificacao: gerado  │
└─────────────────────────────┘
```

## Consultar Status Manualmente

Se quiser consultar o status sem esperar o polling:

```bash
# Via curl
curl -X GET http://localhost:8082/nfse/consultar-status

# Via PowerShell
Invoke-WebRequest -Uri "http://localhost:8082/nfse/consultar-status" -Method Get
```

## Resposta do Polling

```json
{
  "message": "Consulta de status concluída",
  "checked": 3,
  "updated": 1,
  "results": [
    {
      "rps": "8/A",
      "status": "approved",
      "numero_nfse": "123456"
    },
    {
      "rps": "7/A",
      "status": "processing"
    },
    {
      "rps": "6/A",
      "status": "error",
      "erro": "RPS já utilizado"
    }
  ]
}
```

## Logs do Polling

```
[15/12/2025 14:30:45] 🔍 Consultando status de NFS-e...
  📋 Verificadas: 3
  ✅ Atualizadas: 1
    ✅ RPS 8/A - approved
       NFS-e: 123456
    ⏳ RPS 7/A - processing
    ❌ RPS 6/A - error_consulta

```

## Em Produção (Vercel)

Para produção, configure um cronjob externo (ex: AWS Lambda, GitHub Actions) para chamar:

```bash
GET https://seu-dominio.com/api/nfse/consultar-status
```

A cada 5 minutos.

**Exemplo com GitHub Actions:**

```yaml
name: NFS-e Polling
on:
  schedule:
    - cron: '*/5 * * * *'  # A cada 5 minutos
jobs:
  poll:
    runs-on: ubuntu-latest
    steps:
      - name: Consultar status NFS-e
        run: |
          curl -X GET https://seu-dominio.com/api/nfse/consultar-status
```

## Troubleshooting

### "Nenhuma NFS-e em processamento"
✅ Normal! Significa que não há registros aguardando resposta.

### "Erro: ECONNREFUSED"
❌ API Server não está rodando. Inicie com `node dev-server.cjs`

### "Erro ao consultar RPS"
⚠️ Pode ser timeout do webservice municipal. O job tentará novamente no próximo ciclo.

## Próximos Passos

- [ ] Implementar UI para exibir logs do polling em tempo real
- [ ] Configurar alertas quando NFS-e for rejeitada
- [ ] Integrar com sistema de honorários para marcação automática
- [ ] Dashboard com estatísticas de NFS-e (emitidas, aprovadas, em processamento)
