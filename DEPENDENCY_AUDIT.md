# Dependency Audit Report

**Date:** December 26, 2025
**Project:** ampla-contabilidade v1.29.6

---

## Executive Summary

This audit identified **5 security vulnerabilities** (2 high, 3 moderate), **13+ outdated packages** with major version updates available, and **12 unused dependencies** that can be safely removed to reduce bundle size and maintenance burden.

---

## 1. Security Vulnerabilities

### Critical/High Severity

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| **xlsx** | HIGH | Prototype Pollution (GHSA-4r6h-8v6p-xvw6) | **No fix available** - Consider alternative |
| **xlsx** | HIGH | ReDoS vulnerability (GHSA-5pgg-2g8v-p9x9) | **No fix available** - Consider alternative |
| **glob** | HIGH | Command injection via -c/--cmd (GHSA-5j98-mcp5-4vw2) | `npm audit fix` |

### Moderate Severity

| Package | Severity | Issue | Fix |
|---------|----------|-------|-----|
| **esbuild** (via vite) | MODERATE | Development server request vulnerability (GHSA-67mh-4wv8-2f99) | Upgrade vite to v7+ |
| **mdast-util-to-hast** | MODERATE | Unsanitized class attribute (GHSA-4fh9-h7wg-q85m) | `npm audit fix` |

### Recommended Actions

1. **xlsx package (CRITICAL):** This package has unpatched vulnerabilities with no fix available. Consider:
   - Migrating to `exceljs` or `sheetjs-ce` (community edition)
   - If xlsx is essential, ensure it only processes trusted files
   - Implement server-side validation before processing spreadsheets

2. **vite upgrade:** The current vite v5.4.19 has a moderate vulnerability. Upgrading to v7+ is a breaking change that requires testing.

3. **Run `npm audit fix`** to automatically fix glob and mdast-util-to-hast vulnerabilities.

---

## 2. Unused Dependencies (Recommended for Removal)

Based on depcheck analysis, these packages are installed but not imported anywhere in the codebase:

### Production Dependencies to Remove

| Package | Size Impact | Notes |
|---------|-------------|-------|
| `@dnd-kit/core` | ~50KB | Drag-and-drop not used |
| `@dnd-kit/sortable` | ~15KB | Drag-and-drop not used |
| `@dnd-kit/utilities` | ~5KB | Drag-and-drop not used |
| `@hookform/resolvers` | ~20KB | Zod resolver not directly imported |
| `@tanstack/react-query-devtools` | ~200KB | DevTools not imported |
| `axios` | ~30KB | Not imported (supabase client used instead) |
| `crypto-js` | ~100KB | Not imported |
| `fast-xml-parser` | ~40KB | Not imported |
| `react-hot-toast` | ~15KB | **Duplicate** - sonner is used instead |
| `react-is` | ~5KB | Not imported, version mismatch (v19 with React 18) |
| `react-markdown` | ~50KB | Not imported |
| `zustand` | ~10KB | Not imported (React Query used for state) |

**Estimated bundle reduction: ~540KB (uncompressed)**

### DevDependencies to Review

| Package | Notes |
|---------|-------|
| `pg` | Check if used - `postgres` is also installed |
| `postgres` | Two PostgreSQL clients installed - consolidate |

---

## 3. Outdated Packages

### Major Version Updates Available

| Package | Current | Latest | Breaking Changes |
|---------|---------|--------|------------------|
| `date-fns` | 3.6.0 | 4.1.0 | API changes in date formatting |
| `fast-xml-parser` | 4.5.0 | 5.3.3 | New parser API |
| `react-day-picker` | 8.10.1 | 9.13.0 | Component API changes |
| `react-markdown` | 9.0.3 | 10.1.0 | Plugin system changes |
| `react-resizable-panels` | 2.1.9 | 4.0.15 | Layout API changes |
| `react-router-dom` | 6.30.1 | 7.11.0 | New data router APIs |
| `sonner` | 1.7.4 | 2.0.7 | Toast API changes |
| `tailwind-merge` | 2.6.0 | 3.4.0 | Merge strategy changes |
| `vaul` | 0.9.9 | 1.1.2 | Drawer component changes |
| `zod` | 3.25.76 | 4.2.1 | Schema API changes |
| `@hookform/resolvers` | 3.10.0 | 5.2.2 | Resolver interface changes |
| `@dnd-kit/sortable` | 8.0.0 | 10.0.0 | Sortable API changes |

### Minor/Patch Updates (Safe to Update)

| Package | Current | Latest |
|---------|---------|--------|
| Most `@radix-ui/*` packages | Various | Patch updates available |
| `lucide-react` | 0.462.0 | 0.562.0 |
| `next-themes` | 0.3.0 | 0.4.6 |
| `@supabase/supabase-js` | 2.81.1 | 2.89.0 |
| `@tanstack/react-query` | 5.83.0 | 5.90.12 |

---

## 4. Duplicate/Redundant Dependencies

### Toast Libraries (Pick One)
- `sonner` - **Currently used** (92 files import it)
- `react-hot-toast` - **Not used** (0 files import it)

**Recommendation:** Remove `react-hot-toast`

### PostgreSQL Clients (Pick One)
- `pg` - Traditional node-postgres
- `postgres` - Modern postgres.js

**Recommendation:** Audit usage and consolidate to one library

### XML Libraries
Main package has:
- `xml-crypto` v6.1.2
- `xml2js` v0.6.2
- `fast-xml-parser` v4.5.0

nfse/ subfolder has:
- `xml-crypto` v3.2.0 (outdated!)
- `xml2js` v0.6.2
- `libxmljs2` v0.33.0

**Recommendation:** Standardize XML handling, update nfse/xml-crypto to v6+

---

## 5. nfse/ Subfolder Issues

The `nfse/package.json` has separate dependencies that should be aligned:

| Package | nfse/ Version | Main Version | Action |
|---------|---------------|--------------|--------|
| `xml-crypto` | 3.2.0 | 6.1.2 | **Update to 6.x** |
| `node-forge` | 1.3.1 | 1.3.3 | Update |
| `dotenv` | 16.3.1 | 17.2.3 | Update |
| `@types/node` | 20.10.0 | 22.16.5 | Update |
| `typescript` | 5.3.2 | 5.8.3 | Update |
| `eslint` | 8.55.0 | 9.39.1 | Update |

---

## 6. Recommended Actions

### Immediate (Security)

```bash
# Fix automatable vulnerabilities
npm audit fix

# Remove unused react-hot-toast
npm uninstall react-hot-toast react-is
```

### Short-term (Cleanup)

```bash
# Remove all unused dependencies
npm uninstall \
  @dnd-kit/core \
  @dnd-kit/sortable \
  @dnd-kit/utilities \
  @hookform/resolvers \
  @tanstack/react-query-devtools \
  axios \
  crypto-js \
  fast-xml-parser \
  react-hot-toast \
  react-is \
  react-markdown \
  zustand
```

### Medium-term (Updates)

1. Update Radix UI packages to latest patch versions
2. Update `lucide-react` to 0.562.0
3. Update `@supabase/supabase-js` to 2.89.0
4. Update `@tanstack/react-query` to 5.90.12
5. Update `next-themes` to 0.4.6

### Long-term (Breaking Changes)

1. **xlsx replacement:** Evaluate `exceljs` as a secure alternative
2. **vite 7.x upgrade:** Plan migration with testing
3. **zod 4.x upgrade:** Update schemas for new API
4. **react-router-dom 7.x:** Evaluate new data router patterns

---

## 7. Package.json Cleanup Script

```json
{
  "dependencies": {
    // REMOVE these lines:
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "@hookform/resolvers": "^3.10.0",
    "axios": "^1.13.2",
    "crypto-js": "^4.2.0",
    "fast-xml-parser": "^4.5.0",
    "react-hot-toast": "^2.4.1",
    "react-is": "^19.2.0",
    "react-markdown": "^9.0.3",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    // REMOVE this line:
    "@tanstack/react-query-devtools": "^5.83.0"
  }
}
```

---

## Summary

| Category | Count | Action Required |
|----------|-------|-----------------|
| Security vulnerabilities | 5 | Fix 3, mitigate 2 |
| Unused dependencies | 12 | Remove |
| Major updates available | 12 | Plan upgrades |
| Minor updates available | 15+ | Update safely |
| Duplicate libraries | 2 pairs | Consolidate |

**Estimated Impact:**
- Bundle size reduction: ~540KB
- Fewer security alerts
- Reduced maintenance burden
- Cleaner dependency tree
