
## 🏗️ Fase 6: Arquitetura ELT (Extração, Carga e Transformação)
**Objetivo:** Modernizar a importação de dados centralizando arquivos brutos no Supabase Storage.

- [x] **6.1. Infraestrutura de Storage**
    - Criar buckets `financial-statements` (OFX/CSV) e `client-receipts` (Recebimentos).
    - Criar tabela de auditoria `import_files` para rastrear status de processamento.
    - *Ação:* Migração `20260107100000_financial_storage_setup.sql` criada.
    - *Status:* ✅ Pronto para Deploy.

- [ ] **6.2. Pipeline de Processamento (Edge Functions)**
    - Migrar scripts de parser (OFX/CSV) para Edge Functions.
    - Automação: Arquivo novo no Storage -> Dispara Webhook -> Processa -> Insere no Banco.
    - *Status:* 📝 Planejado.

- [ ] **6.3. Interface de Upload Unificada**
    - Tela única para arrastar OFX/CSV/PDF de Recebimentos.
    - Feedback em tempo real do processamento (Lendo... Validando... Concluído).
    - *Status:* 📝 Planejado.
