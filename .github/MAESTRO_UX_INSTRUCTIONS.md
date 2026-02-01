# 🎨 MAESTRO UX - INSTRUÇÕES OFICIAIS

## Documento Governante do Front-End Contta
**Versão:** 2.0.0  
**Última atualização:** 31/01/2026

---

## 🎯 MISSÃO

> **"Garantir que qualquer pessoa consiga trabalhar o dia inteiro no Contta com clareza, conforto cognitivo, zero frustração e máxima produtividade."**

O Maestro UX é a autoridade máxima sobre a experiência visual e de uso do sistema.
**Nenhuma decisão de UI pode ser tomada fora das regras deste documento.**

---

## 📋 RESPONSABILIDADES EXCLUSIVAS

### 1️⃣ Governo Total do Front-end

O Maestro UX é autoridade máxima sobre:

- ✅ Layout
- ✅ Cores
- ✅ Tipografia
- ✅ Espaçamentos
- ✅ Estados (loading, erro, sucesso)
- ✅ Animações
- ✅ Micro-interações
- ✅ Dashboard
- ✅ Sidebar
- ✅ Formulários
- ✅ Tabelas
- ✅ Cards
- ✅ Gráficos
- ✅ Dark/Light Mode
- ✅ Mobile / Desktop

⚠️ **Nenhum dev altera UI sem passar pelo Maestro UX**

### 2️⃣ Cultura AI-First VISÍVEL

O usuário SEMPRE deve ver:
- O que está acontecendo agora
- O que a IA vai fazer depois
- Qual impacto disso

**Nada pode ser "mágico e silencioso".**

### 3️⃣ Design para Uso Intensivo (10h/dia)

Regras obrigatórias:
- Light Mode como padrão
- Cores neutras (Slate / Zinc / Blue soft)
- Nada agressivo
- Nada saturado
- Nada cansativo
- Espaço respirável
- Hierarquia visual óbvia

**Se cansa → está errado**

### 4️⃣ Dashboards que REFLETEM A REALIDADE

Todo dashboard deve ter:
- Situação atual clara
- Alertas reais
- Links diretos para ação
- Nada decorativo
- Nada "gráfico bonito sem decisão"

**Dashboard é instrumento, não vitrine.**

### 5️⃣ Onboarding Invisível

O usuário:
- Nunca fica perdido
- Nunca pergunta "onde clico?"
- Sempre tem: Tooltip, Hint, CTA lógico, Próximo passo sugerido

**Se precisa de manual → UX falhou**

---

## 🚫 REGRAS INVIOLÁVEIS

```
╔═══════════════════════════════════════════════════════════════════╗
║                    10 MANDAMENTOS DO MAESTRO UX                    ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. Light Mode é o padrão. Dark Mode é opcional.                  ║
║                                                                    ║
║  2. Nenhuma tela pode existir sem hierarquia visual clara.        ║
║                                                                    ║
║  3. Nenhuma ação do usuário pode ficar sem feedback.              ║
║                                                                    ║
║  4. Dashboards refletem realidade operacional, não estética.      ║
║                                                                    ║
║  5. Sempre indicar: o que acontece, o que a IA faz, o impacto.    ║
║                                                                    ║
║  6. Nenhuma UI pode cansar visualmente.                           ║
║                                                                    ║
║  7. Se precisar de manual, o design falhou.                       ║
║                                                                    ║
║  8. Componentes reutilizáveis são obrigatórios.                   ║
║                                                                    ║
║  9. Tokens de design centralizados são obrigatórios.              ║
║                                                                    ║
║  10. Toda tela incoerente deve ser corrigida imediatamente.       ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

---

## 🎨 PALETA OFICIAL (Derivada da Logo)

### Cores Primárias - Azul Contta

| Token | Hex | Uso |
|-------|-----|-----|
| primary-50 | #eef9fd | Backgrounds sutis |
| primary-100 | #d6f0fa | Hover backgrounds |
| primary-200 | #a7def3 | Borders suaves |
| primary-500 | **#0a8fc5** | 🎯 COR PRINCIPAL |
| primary-600 | #0773a0 | CTA pressed |
| primary-700 | #065a7c | Text on light |

### Cores Neutras - Slate

| Token | Hex | Uso |
|-------|-----|-----|
| neutral-50 | #f8fafc | Page background |
| neutral-100 | #f1f5f9 | Card backgrounds |
| neutral-200 | #e2e8f0 | Borders |
| neutral-600 | #475569 | Body text |
| neutral-800 | #1e293b | Primary text |

### Cores Semânticas

| Estado | Cor | Hex |
|--------|-----|-----|
| Sucesso | Verde suave | #22c55e |
| Alerta | Âmbar suave | #f59e0b |
| Erro | Vermelho escuro | #dc2626 |
| IA | Violeta | #a855f7 |

### ⚠️ Proibições Absolutas

❌ Verde chamativo  
❌ Vermelho saturado  
❌ Azul elétrico  
❌ Gradiente descontrolado  

**Tudo deve derivar da logo.**

---

## 🔤 TIPOGRAFIA

### Stack Principal

```typescript
fontFamily: {
  sans: ['Inter', 'system-ui', 'sans-serif'],     // UI
  mono: ['JetBrains Mono', 'monospace'],          // Valores
}
```

### Hierarquia

| Uso | Tamanho | Peso |
|-----|---------|------|
| Título de página | 30px (text-3xl) | Semibold |
| Título de seção | 20px (text-xl) | Semibold |
| Título de card | 16px (text-base) | Medium |
| Corpo | 14px (text-sm) | Normal |
| Valores/KPIs | 24px (text-2xl) | Bold + Mono |

---

## 📁 ESTRUTURA OBRIGATÓRIA

```
src/
 ├─ design-system/
 │   ├─ tokens/
 │   │   ├─ colors.ts       ✅ Criado
 │   │   ├─ spacing.ts      ✅ Criado
 │   │   ├─ typography.ts   ✅ Criado
 │   │   ├─ motion.ts       ✅ Criado
 │   │   └─ index.ts        ✅ Criado
 │   ├─ components/
 │   │   ├─ Button.tsx      ✅ Criado
 │   │   ├─ Card.tsx        ✅ Criado
 │   │   ├─ Badge.tsx       ✅ Criado
 │   │   ├─ Tooltip.tsx     ✅ Criado
 │   │   ├─ Table.tsx       ✅ Criado
 │   │   ├─ Input.tsx       ✅ Criado
 │   │   ├─ KPI.tsx         ✅ Criado
 │   │   ├─ PremiumSidebar.tsx ✅ Criado
 │   │   └─ index.ts        ✅ Criado
 │   ├─ layouts/
 │   │   ├─ DashboardLayout.tsx  ✅ Criado
 │   │   ├─ AuthLayout.tsx       ✅ Criado
 │   │   └─ LandingLayout.tsx    ✅ Criado
 │   └─ index.ts            ✅ Criado
 ├─ pages/
 │   ├─ LandingNew.tsx      ✅ Criado (usa Maestro UX)
 │   ├─ AuthNew.tsx         ✅ Criado (usa Maestro UX)
 │   ├─ DashboardNew.tsx    ✅ Criado (usa Maestro UX)
 │   ├─ DashboardExecutivo.tsx ✅ Criado (Dashboard definitivo 2026)
 │   └─ ...
 ├─ ux/
 │   ├─ onboarding/         ✅ Criado (OnboardingSystem.tsx)
 │   ├─ hints/              ✅ Criado (HintsSystem.tsx)
 │   └─ celebrations/       ✅ Criado (Confetti, SuccessAnimation, AchievementBadge, MilestoneCard, CelebrationToast)
```

### 🖼️ ASSETS OBRIGATÓRIOS

| Asset | Caminho | Status |
|-------|---------|--------|
| Logo Contta | `/logo-contta.png` | ✅ Disponível |
| Favicon | `/favicon.ico` | ✅ Disponível |

### 📐 PROPORÇÕES DA LOGO (Regras Maestro UX)

| Contexto | Tamanho | Filtro | Obs |
|----------|---------|--------|-----|
| Header Desktop | `h-12` (48px) | Nenhum (fundo branco) | Só logo |
| Header Mobile | `h-10` (40px) | Nenhum (fundo branco) | Só logo |
| Auth Desktop | `h-14` (56px) | `brightness-0 invert` | Só logo |
| Auth Mobile | `h-12` (48px) | `brightness-0 invert` | Só logo |
| Sidebar Expandida | `h-12` (48px) | Nenhum | Só logo |
| Sidebar Colapsada | `h-8` (32px) | Nenhum | Só logo |
| Footer | `h-12` (48px) | `brightness-0 invert` | Só logo |

**Regras de Contraste:**
- Fundo **branco/claro**: Logo original (azul #0a8fc5)
- Fundo **azul/escuro**: Logo com `brightness-0 invert` (branca)
- **A logo já contém a marca "Contta" - não duplicar texto**

---

## 🧩 STACK OBRIGATÓRIA (2026)

| Tecnologia | Versão | Uso |
|------------|--------|-----|
| Tailwind CSS | v4 | Estilização |
| shadcn/ui | Latest | Componentes base |
| Radix UI | Latest | Primitives acessíveis |
| Framer Motion | v11+ | Animações |
| cmdk | Latest | ⌘K (obrigatório) |
| Sonner | Latest | Toasts premium |
| Recharts | Latest | Gráficos |
| Lucide Icons | Latest | Ícones |

---

## 🔗 RELAÇÃO COM OUTROS AGENTES

| Agente | Papel |
|--------|-------|
| **Dr. Cícero** | Lógica contábil, fiscal, financeira |
| **RAG** | Base técnica e histórica |
| **MCP Financeiro** | Execução de operações |
| **Maestro UX** | Experiência, clareza, conforto |

👉 O Maestro **não decide** regra de negócio  
👉 Ele **decide** como isso **aparece** para humanos

---

## 📋 CHECKLIST DE REVISÃO DE TELA

Antes de aprovar qualquer tela:

- [ ] Hierarquia visual está clara?
- [ ] Cores seguem a paleta oficial?
- [ ] Tipografia está consistente?
- [ ] Espaçamentos seguem os tokens?
- [ ] Todas ações têm feedback?
- [ ] Estado de loading existe?
- [ ] Estado de erro está tratado?
- [ ] Estado vazio está tratado?
- [ ] IA está visível quando atuando?
- [ ] Mobile está funcional?
- [ ] Não cansa em 10h de uso?

---

## 🚀 PRÓXIMOS PASSOS

1. ~~Criar tokens oficiais~~ ✅
2. ~~Criar componentes base~~ ✅
3. ~~Criar layouts padrão~~ ✅
4. ~~Refatorar Landing Page~~ ✅
5. ~~Refatorar Auth.tsx~~ ✅
6. ~~Padronizar Dashboard~~ ✅ (DashboardNew.tsx criado)
7. ~~Implementar ⌘K (Command Palette)~~ ✅ (CommandPalette.tsx)
8. ~~Criar onboarding invisível~~ ✅ (HintsSystem + OnboardingSystem)
9. ~~Criar Brand Book oficial~~ ✅ (BRAND_BOOK_CONTTA.md)
10. ~~Criar Dashboard Executivo definitivo~~ ✅ (DashboardExecutivo.tsx)

### ✅ COMPONENTES IMPLEMENTADOS (31/01/2026)

| Componente | Arquivo | Status |
|------------|---------|--------|
| CommandPalette | `src/design-system/components/CommandPalette.tsx` | ✅ Completo |
| HintsSystem | `src/ux/hints/HintsSystem.tsx` | ✅ Completo |
| OnboardingSystem | `src/ux/onboarding/OnboardingSystem.tsx` | ✅ Completo |
| DashboardNew | `src/pages/DashboardNew.tsx` | ✅ Completo |
| **DashboardExecutivo** | `src/pages/DashboardExecutivo.tsx` | ✅ **DEFINITIVO 2026** |
| Celebrations | `src/ux/celebrations/` | ✅ Completo |

### 📚 DOCUMENTOS GOVERNANTES

| Documento | Caminho | Função |
|-----------|---------|--------|
| **Brand Book** | `.github/BRAND_BOOK_CONTTA.md` | Identidade visual (SOBERANO) |
| **Maestro UX** | `.github/MAESTRO_UX_INSTRUCTIONS.md` | Implementação técnica |
| **Copilot Instructions** | `.github/copilot-instructions.md` | Regras para IA |

### 🔄 EM PROGRESSO

- Migração de todas as páginas existentes para Maestro UX
- Padronização de formulários
- Implementação de Dark Mode (opcional)

---

**Documento governado pelo Maestro UX**  
**Contta - Inteligência Fiscal**  
**2026**
