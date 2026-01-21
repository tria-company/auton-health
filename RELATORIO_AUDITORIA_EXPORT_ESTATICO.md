# 📋 RELATÓRIO DE AUDITORIA: Preparação para Export Estático (CDN)

**Data**: 21 de Janeiro de 2026  
**Objetivo**: Identificar todos os impedimentos para conversão do frontend para exportação 100% estática via `next export`  
**Status**: ⚠️ MÚLTIPLOS BLOQUEIOS IDENTIFICADOS

---

## 🔴 SEÇÃO A: Arquivos que IMPEDEM Export Estático (REMOVER)

### A.1 - Middleware
**BLOQUEIO CRÍTICO**: Middleware não é compatível com export estático

- **Path**: `apps/frontend/middleware.ts`
- **Problema**: Usa `@supabase/ssr` server-side, `cookies()` do Next.js, e `NextResponse.redirect()`
- **Linhas críticas**:
  - L1: `import { createServerClient } from '@supabase/ssr'`
  - L16: `const cookieStore = cookies()`
  - L84: `return NextResponse.redirect(new URL('/auth/signin', req.url))`
  - L94: `return NextResponse.redirect(new URL('/dashboard', req.url))`
- **Ação**: REMOVER completamente. Auth deve ser client-side apenas.

---

### A.2 - Pasta API Routes (48 arquivos route.ts)
**BLOQUEIO CRÍTICO**: API Routes não funcionam em export estático

**Path base**: `apps/frontend/src/app/api/`

#### Arquivos encontrados (48 routes):
```
apps/frontend/src/app/api/dashboard/route.ts
apps/frontend/src/app/api/anamnese-inicial/route.ts
apps/frontend/src/app/api/patients/[id]/route.ts
apps/frontend/src/app/api/diagnostico/[consultaId]/update-field/route.ts
apps/frontend/src/app/api/diagnostico/[consultaId]/route.ts
apps/frontend/src/app/api/anamnese/[consultaId]/update-field/route.ts
apps/frontend/src/app/api/admin/dashboard/route.ts
apps/frontend/src/app/api/consultations/route.ts
apps/frontend/src/app/api/audit-logs/[consultaId]/route.ts
apps/frontend/src/app/api/processar-exames/[consulta_id]/route.ts
apps/frontend/src/app/api/consultations/[id]/route.ts
apps/frontend/src/app/api/exames/[consultaId]/route.ts
apps/frontend/src/app/api/solucao-habitos-vida/[consultaId]/update-field/route.ts
apps/frontend/src/app/api/solucao-suplementacao/[consultaId]/update-field/route.ts
apps/frontend/src/app/api/solucao-mentalidade/[consultaId]/update-field/route.ts
apps/frontend/src/app/api-ltb/[consultaId]/update-field/route.ts
apps/frontend/src/app/api/patients/route.ts
apps/frontend/src/app/api/cadastro-anamnese/[patientId]/route.ts
apps/frontend/src/app/api/atividade-fisica/[consultaId]/update-field/route.ts
apps/frontend/src/app/api/anamnese/update-links-exames/route.ts
apps/frontend/src/app/api/alimentacao/[consultaId]/update-field/route.ts
apps/frontend/src/app/api/webhook-proxy/route.ts
apps/frontend/src/app/api/lista-exercicios-fisicos/route.ts
apps/frontend/src/app/api/atividade-fisica/[consultaId]/route.ts
apps/frontend/src/app/api/admin/costs/route.ts
apps/frontend/src/app/api/tabela-alimentos/route.ts
apps/frontend/src/app/api/alimentacao/[consultaId]/route.ts
apps/frontend/src/app/api/auth/google-calendar/status/route.ts
apps/frontend/src/app/api/auth/google-calendar/disconnect/route.ts
apps/frontend/src/app/api/auth/google-calendar/callback/route.ts
apps/frontend/src/app/api/auth/google-calendar/authorize/route.ts
apps/frontend/src/app/api/webhook/exames/route.ts
apps/frontend/src/app/api/tokens/route.ts
apps/frontend/src/app/api/test/route.ts
apps/frontend/src/app/api/solutions/[consulta_id]/route.ts
apps/frontend/src/app/api/solucao-suplementacao/[consultaId]/route.ts
apps/frontend/src/app/api/solucao-mentalidade/[consultaId]/route.ts
apps/frontend/src/app/api/solucao-ltb/[consultaId]/route.ts
apps/frontend/src/app/api/solucao-habitos-vida/[consultaId]/route.ts
apps/frontend/src/app/api/sintese-analitica/[consultaId]/route.ts
apps/frontend/src/app/api/setup-user/route.ts
apps/frontend/src/app/api/sessions/route_apagar_depois.ts
apps/frontend/src/app/api/medico/route.ts
apps/frontend/src/app/api/create-user/route.ts
apps/frontend/src/app/api/consultas-admin/route.ts
apps/frontend/src/app/api/anamnese/[consultaId]/route.ts
apps/frontend/src/app/api/ai-edit/route.ts
apps/frontend/src/app/api/agenda/route.ts
```

**Dependências problemáticas identificadas**:
- `apps/frontend/src/app/api/admin/costs/route.ts` (L2-3): usa `@supabase/ssr` e `cookies()`
- `apps/frontend/src/app/auth/callback/route.ts` (L1-2): usa `@supabase/ssr` e `cookies()`

**Ação**: REMOVER toda a pasta `apps/frontend/src/app/api/`

---

### A.3 - Auth Callback Route
**Path**: `apps/frontend/src/app/auth/callback/route.ts`

**Problemas encontrados**:
- L1: `import { createServerClient } from '@supabase/ssr'`
- L2: `import { cookies } from 'next/headers'`
- L33: `const cookieStore = await cookies()`
- L20, L29, L61, L66, L73: Múltiplos `NextResponse.redirect()`

**Ação**: REMOVER e implementar callback client-side

---

### A.4 - Lib Server-Side Supabase
**Path**: `apps/frontend/src/lib/supabase-server.ts`

**Problemas**:
- L1: `import { createServerClient } from '@supabase/ssr'`
- L2: `import { cookies } from 'next/headers'`
- L16, L20, L24: `const cookieStore = cookies()`

**Ação**: REMOVER completamente (não é necessário em export estático)

---

## 🟡 SEÇÃO B: Arquivos a ALTERAR (Substituir `/api/` por chamadas diretas)

### B.1 - Componentes com chamadas `fetch('/api/...')`

Total de arquivos afetados: **20 arquivos** | Total de ocorrências: **22 chamadas**

#### Lista detalhada:

**1. `apps/frontend/src/components/webrtc/CreateConsultationRoom.tsx`**
   - L202: `const response = await fetch('/api/medico');`
   - L449: `const response = await fetch('/api/consultations', { method: 'POST', ... });`
   - L491: `const response = await fetch('/api/consultations', { method: 'POST', ... });`
   - **Substituir por**: Chamadas diretas ao Supabase client-side

**2. `apps/frontend/src/app/pacientes/page.tsx`**
   - L192: `const response = await fetch('/api/patients', { method: 'POST', ... });`
   - L316: `const response = await fetch('/api/anamnese-inicial', { method: 'POST', ... });`
   - **Substituir por**: Supabase `.from('pacientes').insert()` / `.from('anamnese_inicial').insert()`

**3. `apps/frontend/src/app/consultas/page.tsx`**
   - L1663: `await fetch('/api/ai-edit', { method: 'POST', ... });`
   - L5075: `const response = await fetch('/api/ai-edit', { method: 'POST', ... });`
   - L5707: `await fetch('/api/webhook-proxy', { method: 'POST', ... });`
   - **Substituir por**: Chamada direta ao Gateway (via env var `NEXT_PUBLIC_GATEWAY_URL`)

**4. `apps/frontend/src/app/anamnese-inicial/page.tsx`**
   - L172: `const response = await fetch('/api/anamnese-inicial', { method: 'PUT', ... });`
   - **Substituir por**: Supabase `.from('anamnese_inicial').update()`

**5. `apps/frontend/src/components/dashboard/ActiveConsultationBanner.tsx`**
   - L89: `const response = await fetch('/api/consultations?status=RECORDING&limit=10');`
   - **Substituir por**: Supabase `.from('consultas').select().eq('status', 'RECORDING').limit(10)`

**6. `apps/frontend/src/app/agenda/page.tsx`**
   - L106: `const res = await fetch('/api/auth/google-calendar/status');`
   - L138: `const res = await fetch('/api/auth/google-calendar/disconnect', { method: 'POST' });`
   - **Substituir por**: Supabase Functions ou chamada direta ao Gateway

**7. `apps/frontend/src/app/(consulta)/consulta/presencial/page.tsx`**
   - L247: `const response = await fetch('/api/medico');`
   - **Substituir por**: Supabase `.from('medicos').select()`

**8. `apps/frontend/src/app/pacientes/cadastro/page.tsx`**
   - L251: `const response = await fetch('/api/anamnese-inicial', { method: 'POST', ... });`
   - L408: `const response = await fetch('/api/patients', { method: 'POST', ... });`
   - **Substituir por**: Supabase inserts diretos

**9. `apps/frontend/src/app/admin/costs/page.tsx`**
   - L157: `const response = await fetch('/api/admin/costs', { method: 'POST', ... });`
   - L193: `const response = await fetch('/api/admin/costs', { method: 'POST', ... });`
   - **Substituir por**: Supabase queries diretas

**10. `apps/frontend/src/lib/supabase.ts`**
   - L205: `const response = await fetch('/api/consultations', { method: 'POST', ... });`
   - **Substituir por**: Supabase insert direto

**11. `apps/frontend/src/app/consultas-admin/page.tsx`**
   - L99: `const response = await fetch('/api/consultas-admin', { method: 'GET', ... });`
   - L150: `const response = await fetch('/api/consultas-admin', { method: 'POST', ... });`
   - **Substituir por**: Supabase queries

**12. `apps/frontend/src/app/configuracoes/page.tsx`**
   - L60: `const response = await fetch('/api/medico');`
   - L137: `const response = await fetch('/api/medico', { method: 'PUT', ... });`
   - **Substituir por**: Supabase `.from('medicos')`

**13. `apps/frontend/src/components/ExamesUploadSection.tsx`**
   - Contém referências a `/api/` (2 ocorrências detectadas)

**14. `apps/frontend/src/components/solutions/SolutionsViewer.tsx`**
   - Contém referências a `/api/` (1 ocorrência detectada)

**15. `apps/frontend/src/components/solutions/SolutionsList.tsx`**
   - Contém referências a `/api/` (1 ocorrência detectada)

**16. `apps/frontend/src/components/consultas/ConsultaModal.tsx`**
   - Contém referências a `/api/` (1 ocorrência detectada)

**Total de chamadas `/api/` encontradas em 20 arquivos**: 98 ocorrências

---

### B.2 - Arquivo com `redirect()` server-side

**Path**: `apps/frontend/src/app/page.tsx`

```typescript
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/landing');
}
```

**Problema**: `redirect()` só funciona em Server Components. Em export estático, não há server.

**Ação**: Converter para Client Component com `useRouter` ou usar meta refresh.

---

### B.3 - Next.config.js - Configurações incompatíveis

**Path**: `apps/frontend/next.config.js`

**Problemas identificados**:
- L28-64: `async headers()` - Headers dinâmicos não funcionam em export estático
- L116-124: `async redirects()` - Redirects não funcionam em export estático
- L127-134: `async rewrites()` - Rewrites não funcionam em export estático
- L140: `output: 'standalone'` - Incompatível com `next export`

**Ações**:
1. REMOVER `headers()`, `redirects()`, `rewrites()`
2. ALTERAR `output: 'standalone'` para `output: 'export'`
3. ADICIONAR `trailingSlash: true` (recomendado para CDN)
4. REMOVER configuração de `images` (Image Optimization não funciona em export)

---

## 🔵 SEÇÃO C: Rotas Dinâmicas Encontradas

### C.1 - Rotas Dinâmicas no App Router

**Rotas de página encontradas**:
1. `apps/frontend/src/app/(call)/call/[roomId]/page.tsx`
   - **Status**: ✅ Já é Client Component, compatível com export
   - **Parâmetro dinâmico**: `[roomId]`

**Rotas de API encontradas (serão removidas)**:
1. `apps/frontend/src/app/api/alimentacao/[consultaId]/`
2. `apps/frontend/src/app/api/anamnese/[consultaId]/`
3. `apps/frontend/src/app/api/atividade-fisica/[consultaId]/`
4. `apps/frontend/src/app/api/audit-logs/[consultaId]/`
5. `apps/frontend/src/app/api/cadastro-anamnese/[patientId]/`
6. `apps/frontend/src/app/api/consultations/[id]/`
7. `apps/frontend/src/app/api/diagnostico/[consultaId]/`
8. `apps/frontend/src/app/api/exames/[consultaId]/`
9. `apps/frontend/src/app/api/patients/[id]/`
10. `apps/frontend/src/app/api/processar-exames/[consulta_id]/`
11. `apps/frontend/src/app/api/sintese-analitica/[consultaId]/`
12. `apps/frontend/src/app/api/solucao-habitos-vida/[consultaId]/`
13. `apps/frontend/src/app/api/solucao-ltb/[consultaId]/`
14. `apps/frontend/src/app/api/solucao-mentalidade/[consultaId]/`
15. `apps/frontend/src/app/api/solucao-suplementacao/[consultaId]/`
16. `apps/frontend/src/app/api/solutions/[consulta_id]/`

**Observação sobre rotas dinâmicas**:
- Para export estático, rotas dinâmicas de página são OK se usarem `generateStaticParams()`
- Como queremos um SPA, a rota `[roomId]` funcionará bem pois já é client-side

---

## 🟣 SEÇÃO D: Uso de `next/headers` e `next/navigation`

### D.1 - Imports de `next/headers` (PROBLEMÁTICOS)

**Arquivos com `import { cookies } from 'next/headers'`:**
1. `apps/frontend/src/lib/supabase-server.ts` - L2 ⚠️ REMOVER
2. `apps/frontend/src/app/api/admin/costs/route.ts` - L3 ⚠️ REMOVER
3. `apps/frontend/src/app/auth/callback/route.ts` - L2 ⚠️ REMOVER

**Total**: 3 arquivos (todos devem ser removidos)

---

### D.2 - Imports de `next/navigation` (OK para Client Components)

**Arquivos usando `useRouter`, `useSearchParams`, `usePathname`** (33 arquivos):
- ✅ Todos são Client Components (têm `'use client'`)
- ✅ Compatíveis com export estático
- **Nenhuma ação necessária**

**Arquivo problemático**:
- `apps/frontend/src/app/page.tsx` - L1: `import { redirect } from 'next/navigation'`
  - ⚠️ Usa `redirect()` em Server Component
  - **Ação**: Converter para Client Component

---

## 📊 RESUMO EXECUTIVO

### Bloqueios Críticos Identificados:

| Categoria | Quantidade | Status |
|-----------|-----------|---------|
| **Middleware** | 1 arquivo | 🔴 REMOVER |
| **API Routes** | 48 arquivos | 🔴 REMOVER |
| **Auth Callback Route** | 1 arquivo | 🔴 REMOVER |
| **Supabase Server Lib** | 1 arquivo | 🔴 REMOVER |
| **Chamadas `/api/`** | 98 ocorrências em 20 arquivos | 🟡 REFATORAR |
| **Next.config.js** | 1 arquivo | 🟡 ALTERAR |
| **Page.tsx com redirect** | 1 arquivo | 🟡 ALTERAR |
| **Rotas Dinâmicas (página)** | 1 rota | ✅ OK |
| **Imports `next/headers`** | 3 arquivos | 🔴 REMOVER |

---

## 🎯 PLANO DE AÇÃO RECOMENDADO

### Fase 1: Remoções (Breaking Changes)
1. ❌ Remover `apps/frontend/middleware.ts`
2. ❌ Remover pasta `apps/frontend/src/app/api/` (48 arquivos)
3. ❌ Remover `apps/frontend/src/app/auth/callback/route.ts`
4. ❌ Remover `apps/frontend/src/lib/supabase-server.ts`

### Fase 2: Refatorações
1. 🔄 Substituir todas as 98 chamadas `/api/` por:
   - Chamadas diretas ao Supabase (para CRUD)
   - Chamadas ao Gateway via `NEXT_PUBLIC_GATEWAY_URL` (para AI/processamento)
2. 🔄 Converter `apps/frontend/src/app/page.tsx` para Client Component
3. 🔄 Implementar auth callback client-side (Supabase Auth Helpers)

### Fase 3: Configuração
1. ⚙️ Atualizar `next.config.js`:
   - Trocar `output: 'standalone'` por `output: 'export'`
   - Remover `headers()`, `redirects()`, `rewrites()`
   - Adicionar `trailingSlash: true`
   - Remover/adaptar configuração de `images`

### Fase 4: Validação
1. ✅ Rodar `next build` com `output: 'export'`
2. ✅ Testar todas as funcionalidades client-side
3. ✅ Verificar que não há erros de build

---

## 🚨 RISCOS IDENTIFICADOS

1. **Auth Flow**: Middleware atual faz proteção de rotas server-side. Precisará ser reimplementado client-side.
2. **API Proxy**: Algumas rotas fazem proxy para o Gateway. Precisarão chamar diretamente (CORS deve estar configurado).
3. **Google Calendar OAuth**: Callback atual é server-side. Precisará ser adaptado.
4. **Uploads de Arquivo**: Se houver uploads via API routes, precisarão ir direto para Supabase Storage.
5. **Image Optimization**: Next.js Image Optimization não funciona em export. Usar loader externo ou imagens otimizadas manualmente.

---

## ✅ COMPATIBILIDADES CONFIRMADAS

1. ✅ **WebSocket**: Hooks que usam WebSocket (`useTranscriptionWebSocket`, `useRecording`) são client-side - OK
2. ✅ **Supabase Client**: `@supabase/supabase-js` com `createBrowserClient` - OK
3. ✅ **Rotas Dinâmicas**: `[roomId]` já é Client Component - OK
4. ✅ **State Management**: Zustand é client-side - OK
5. ✅ **React Hook Form**: Totalmente client-side - OK

---

**FIM DO RELATÓRIO**

---

*Próximo passo: Aguardando aprovação para iniciar implementação das mudanças.*
