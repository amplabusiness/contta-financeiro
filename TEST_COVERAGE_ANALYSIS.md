# Test Coverage Analysis — Contta Financeiro

**Date:** 2026-02-06
**Scope:** Full codebase analysis of `/src`, `/tests`, `/supabase/functions`, and utility scripts

---

## 1. Current State of Testing

### What exists today

| Category | Files | Lines of Test Code | Notes |
|---|---|---|---|
| Vitest integrity tests | 2 | ~570 | `tests/integrity/` — database-level checks |
| Manual test scripts | 6 | ~300 | Root-level `test_*.mjs` files, run ad-hoc |
| Mock scanner | 1 | ~50 | `scripts/scan-for-mocks.js` — prevents mocks in prod |

### What is missing

- **No `test` script in `package.json`** — `npm test` does nothing.
- **No `vitest.config.ts`** — Vitest runs with zero configuration.
- **No code coverage** — no coverage tool configured, no reports generated.
- **No CI test execution** — `deploy.yml` runs `npm run build` but never runs tests.
- **Zero unit tests** for any frontend code (components, hooks, services, utilities).
- **Zero unit tests** for any Supabase Edge Function.
- **No E2E framework** (no Playwright, Cypress, or similar).

### Existing tests are integration-only

Both files in `tests/integrity/` connect to a live Supabase instance and query real data. They validate:

- **Reconciliation invariants** — transactions with `journal_entry_id` must have `status='reconciled'`.
- **RPC existence** — `reconcile_transaction` and `unreconcile_transaction` must be callable.
- **Transitória balances** — temporary accounts should tend toward zero.
- **Audit infrastructure** — `document_catalog`, `monthly_closings`, `learned_rules` tables exist and contain expected data.
- **RPC responses** — `generate_monthly_audit_data` and `close_month` return correct shapes.

These are valuable for catching regressions in the database layer, but they cover none of the application logic.

---

## 2. Risk Assessment

### Critical untested areas (sorted by business impact)

#### P0 — Financial Integrity (could cause incorrect accounting entries)

| File | Functions | Risk |
|---|---|---|
| `src/services/AccountingService.ts` | `createEntry()`, double-entry validation, idempotency check, synthetic account blocking | Wrong entries go into the books; debits ≠ credits |
| `src/services/ClassificationService.ts` | `validateClassification()` — 5 Dr. Cícero rules, PIX revenue blocking | Forbidden classifications go through |
| `src/hooks/useImpactCalculation.ts` | Balance projections, DRE calculations, warning generation | Users see wrong impact previews, approve bad entries |
| `src/hooks/usePayrollAccounting.ts` | Salary aggregation, duplicate detection, rollback logic | Double payroll entries, missing INSS/IRRF |

#### P1 — Data Ingestion (could corrupt imported data)

| File | Functions | Risk |
|---|---|---|
| `src/lib/ofxParser.ts` | `parseOFXSGML()`, `parseOFXXML()`, date parsing, amount sign detection | Bank statements imported with wrong dates, amounts, or types |
| `src/lib/csvParser.ts` | `parseBrazilianCurrency()`, `parseDate()`, `detectSeparator()`, `parseCSVLine()` | CSV imports silently drop rows or misparse values |
| `src/utils/parseCobrancaFile.ts` | `parseCobrancaCSV()`, old vs new format detection, `groupByDocumento()` | Boleto collection files parsed incorrectly |
| `src/lib/classificadorAutomatico.ts` | `classificarTransacaoOFX()` — 77 regex patterns, `classificarNotaFiscal()`, `classificarEventoFolha()` | Auto-classification assigns wrong accounts |

#### P2 — Reconciliation Logic (could miss or misattribute payments)

| File | Functions | Risk |
|---|---|---|
| `src/services/BoletoReconciliationService.ts` | `extractCobCode()`, `similarity()`, `calculateConfidence()`, `findCombination()` (backtracking) | Payments attributed to wrong clients, missed matches |
| `src/services/AutoReconciliationPipeline.ts` | Confidence thresholds, pipeline step transitions, batch processing | Auto-reconciliation runs with wrong thresholds |
| `src/services/FinancialIntelligenceService.ts` | `analyzeBankTransaction()` — 20+ decision paths, PIX golden rule | Revenue recognition errors, rule violations |

#### P3 — Supporting Logic

| File | Functions | Risk |
|---|---|---|
| `src/lib/formatters.ts` | `formatCNPJ()`, `formatCPF()`, `formatDocument()` | Display issues, CNPJ/CPF validation failures |
| `src/lib/utils.ts` | `getErrorMessage()` — 9-step cascading extraction | Silent error swallowing, wrong messages shown |
| `src/contexts/PeriodContext.tsx` | `getStartDate()`, `getEndDate()`, month boundary calculations | Reports generated for wrong date ranges |
| `src/hooks/useAuditLog.ts` | Hash chain integrity, `formatAuditEvent()` | Audit trail gaps, integrity verification failures |
| `src/hooks/useDataLake.ts` | File deduplication, text extraction, checksum | Duplicate files, failed indexing |

---

## 3. Recommended Test Plan

### Phase 1 — Pure function unit tests (high value, low effort)

These functions have no side effects and can be tested with simple input/output assertions. They represent the fastest path to meaningful coverage.

**Target files and functions:**

```
src/lib/ofxParser.ts
  - parseOFXDate()          → date string → Date object
  - getTagValue()           → SGML string → extracted value
  - parseOFX()              → OFX string → OFXParseResult
  - Bank code mapping       → code → bank name

src/lib/csvParser.ts
  - detectSeparator()       → CSV header line → separator char
  - parseBrazilianCurrency() → "R$ 1.234,56" → 1234.56
  - parseDate()             → "31/12/2025" → Date object
  - normalizeHeader()       → "Descrição  (R$)" → "descricao_r"
  - parseCSVLine()          → quoted CSV line → string[]

src/lib/classificadorAutomatico.ts
  - classificarTransacaoOFX()   → description → classification
  - classificarNotaFiscal()     → CFOP code → classification
  - classificarEventoFolha()    → event code → classification

src/lib/formatters.ts
  - formatCNPJ()            → "12345678000199" → "12.345.678/0001-99"
  - formatCPF()             → "12345678901" → "123.456.789-01"
  - formatDocument()        → digit string → formatted string
  - normalizeDocument()     → "12.345.678/0001-99" → "12345678000199"

src/utils/parseCobrancaFile.ts
  - parseCobrancaCSV()      → CSV text → CobrancaRecord[]
  - groupByDocumento()      → records → grouped CobrancaGroup[]
  - groupByDataExtrato()    → records → grouped CobrancaGroup[]

src/lib/utils.ts
  - getErrorMessage()       → various error shapes → string
```

**Estimated scope:** ~150-200 test cases across 6 files.

### Phase 2 — Business rule validation tests

These test the classification and validation rules that protect financial data integrity. They require slightly more setup but are still testable without a database.

**Target files and functions:**

```
src/services/ClassificationService.ts
  - validateClassification()   → transaction + account → warnings/errors
  - extractKeywords()          → description → keyword[]

src/services/BoletoReconciliationService.ts
  - extractCobCode()           → description → COB code
  - normalizeClientName()      → "EMPRESA LTDA" → "empresa"
  - similarity()               → (string, string) → 0.0-1.0
  - calculateConfidence()      → match data → confidence score
  - findCombination()          → (amounts[], target) → subset

src/services/FinancialIntelligenceService.ts
  - analyzeBankTransaction()   → transaction → classification suggestion

src/hooks/useImpactCalculation.ts
  - Balance projection logic (extract into pure functions)
  - DRE category grouping (account code → category)
  - Warning generation rules
```

**Estimated scope:** ~100-150 test cases across 4 files.

### Phase 3 — Service layer tests with mocked Supabase

Test the orchestration logic of services by mocking Supabase responses.

**Target files:**

```
src/services/AccountingService.ts
  - createEntry() → validates inputs, checks idempotency, enforces double-entry
  - Synthetic account blocking (NBC TG 26)
  - Reference type/ID requirement (Dr. Cícero rule)

src/services/AutoReconciliationPipeline.ts
  - Pipeline step transitions
  - Confidence threshold decisions (≥90% auto, ≥70% review, <70% skip)
  - Batch processing statistics accumulation
```

**Estimated scope:** ~50-80 test cases across 2 files.

### Phase 4 — Context and date logic tests

```
src/contexts/PeriodContext.tsx
  - getStartDate() / getEndDate() → month boundaries
  - getCompetence() → "01/2025" format
  - getFormattedRange() → range display strings
  - getRangeCompetences() → competence objects for date ranges

src/hooks/useAuditLog.ts
  - formatAuditEvent() → event type → display properties
  - generateLocalHash() → input → hash string
```

**Estimated scope:** ~30-40 test cases.

### Phase 5 — Edge Function tests

The 80+ Supabase Edge Functions (Deno runtime) have zero tests. Priority targets:

```
supabase/functions/parse-ofx-statement/   → OFX file → parsed transactions
supabase/functions/parse-cnab-file/        → CNAB 240/400 → return file data
supabase/functions/cora-banking-service/   → Banking API integration
supabase/functions/notification-dispatcher/ → Multi-channel notification routing
```

### Phase 6 — E2E tests (Playwright)

Cover the most critical user flows end-to-end:

1. **Login → Dashboard** — auth flow and data loading
2. **Bank import** — upload OFX → see transactions → classify → reconcile
3. **Invoice creation** — create honorário → generate boleto → see in collection
4. **Accounting reports** — select period → generate Balancete/DRE → verify totals
5. **Client management** — create client → assign accounts → verify in chart

---

## 4. Infrastructure Recommendations

### Immediate (before writing any tests)

1. **Add test script to `package.json`:**
   ```json
   "test": "vitest run",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage"
   ```

2. **Create `vitest.config.ts`:**
   ```ts
   import { defineConfig } from 'vitest/config';
   import path from 'path';

   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
       include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
       coverage: {
         provider: 'v8',
         reporter: ['text', 'html', 'lcov'],
         include: ['src/lib/**', 'src/services/**', 'src/utils/**', 'src/hooks/**', 'src/contexts/**'],
       },
     },
     resolve: {
       alias: {
         '@': path.resolve(__dirname, './src'),
       },
     },
   });
   ```

3. **Add coverage dependency:**
   ```
   npm install -D @vitest/coverage-v8
   ```

4. **Add test step to CI (`deploy.yml`):**
   ```yaml
   - name: Run tests
     run: npm test
   ```

### Test file organization

```
tests/
├── integrity/                    # existing — keep as-is
│   ├── auditAndLearning.test.ts
│   └── reconciliationIntegrity.test.ts
├── unit/
│   ├── lib/
│   │   ├── ofxParser.test.ts
│   │   ├── csvParser.test.ts
│   │   ├── classificadorAutomatico.test.ts
│   │   ├── formatters.test.ts
│   │   └── utils.test.ts
│   ├── services/
│   │   ├── AccountingService.test.ts
│   │   ├── ClassificationService.test.ts
│   │   ├── BoletoReconciliationService.test.ts
│   │   └── FinancialIntelligenceService.test.ts
│   ├── utils/
│   │   └── parseCobrancaFile.test.ts
│   └── contexts/
│       └── PeriodContext.test.ts
├── integration/
│   └── (future — service + Supabase mock tests)
└── e2e/
    └── (future — Playwright tests)
```

### Move manual scripts

The 6 `test_*.mjs` files in the project root should be moved to `scripts/manual-tests/` to reduce root clutter and make it clear they are not part of the automated suite.

---

## 5. Summary

| Metric | Current | After Phase 1-2 | After All Phases |
|---|---|---|---|
| Automated test files | 2 | ~12 | ~25+ |
| Test cases | ~25 | ~350 | ~500+ |
| Lines with coverage | 0 (no tool) | ~2,000 | ~5,000+ |
| Pure function coverage | 0% | ~80% | ~90% |
| Service logic coverage | 0% | ~30% | ~70% |
| E2E flows covered | 0 | 0 | 5 |
| CI runs tests | No | Yes | Yes |

**Phases 1 and 2 deliver the highest return on investment.** They cover pure functions and business rules that are easy to test, protect the most critical financial logic, and require no infrastructure changes beyond adding `vitest.config.ts`.
