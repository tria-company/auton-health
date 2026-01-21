# 🚀 Deploy do Auton Health na Vercel

## 📋 Pré-requisitos

- Conta na Vercel (https://vercel.com)
- Repositório no GitHub: `tria-company/auton-health`
- Gateway backend rodando (para variáveis de ambiente)

## 🔧 Configuração das Variáveis de Ambiente

Antes de fazer o deploy, você precisa configurar as seguintes variáveis de ambiente na Vercel:

### 1. Acesse o Dashboard da Vercel
- Vá para: https://vercel.com/dashboard
- Clique em "Add New..." → "Project"
- Importe o repositório `tria-company/auton-health`

### 2. Configure as Variáveis de Ambiente

Na seção "Environment Variables", adicione **UMA POR UMA**:

#### Nome da Variável → Valor

**1. NEXT_PUBLIC_SUPABASE_URL**
```
https://yzjlhezmvdkwdhibyvwh.supabase.co
```

**2. NEXT_PUBLIC_SUPABASE_ANON_KEY**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl6amxoZXptdmRrd2RoaWJ5dndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc1MjY2NTcsImV4cCI6MjA3MzEwMjY1N30.6k4ey41rv--Eawi55H_pacZgMrmM-SR--l2t88gV7z0
```

**3. NEXT_PUBLIC_GATEWAY_URL**
```
ws://localhost:3001
```
(⚠️ Altere para `wss://seu-gateway-producao.com` quando o gateway estiver em produção)

**4. NEXT_PUBLIC_GATEWAY_HTTP_URL**
```
http://localhost:3001
```
(⚠️ Altere para `https://seu-gateway-producao.com` quando o gateway estiver em produção)

#### Importante:
- ✅ Clique em "Add" após cada variável
- ✅ Selecione todos os ambientes: **Production**, **Preview**, **Development**
- ⚠️ NÃO use sintaxe de secrets (@secret-name)

### 3. Configurações do Build

A Vercel vai detectar automaticamente as configurações do `vercel.json`:

```json
Build Command: cd apps/frontend && npm install && npm run build
Output Directory: apps/frontend/out
Framework Preset: Other
```

## 🚀 Deploy via Vercel CLI (Alternativa)

Se preferir fazer deploy via CLI:

### 1. Instale a Vercel CLI
```bash
npm install -g vercel
```

### 2. Login na Vercel
```bash
vercel login
```

### 3. Deploy
```bash
cd "/Users/felipeporto/Documents/PROJETO FINAL/homolog-projeto"
vercel
```

### 4. Deploy para Produção
```bash
vercel --prod
```

## 📝 Checklist de Deploy

- [ ] Variáveis de ambiente configuradas na Vercel
- [ ] Gateway backend está rodando
- [ ] Repositório sincronizado no GitHub
- [ ] Build local testado (`npm run build` no frontend)
- [ ] CORS configurado no gateway para aceitar domínio da Vercel

## 🔄 Configuração de CORS no Gateway

Após o deploy, adicione o domínio da Vercel no CORS do gateway:

```typescript
// apps/gateway/src/server.ts
const corsOrigins = [
  'http://localhost:3000',
  'https://seu-dominio.vercel.app', // Adicione seu domínio Vercel aqui
];
```

## 🔗 URLs após Deploy

Após o deploy bem-sucedido, você receberá:
- **Preview URL**: `https://auton-health-xxx.vercel.app` (para cada commit)
- **Production URL**: `https://auton-health.vercel.app` (domínio principal)

## 🛠️ Configurações Adicionais

### Custom Domain (Opcional)
1. Vá em Settings → Domains
2. Adicione seu domínio customizado
3. Configure os DNS conforme instruções da Vercel

### Performance
- ✅ CDN Global automático
- ✅ Compressão Brotli/Gzip
- ✅ HTTP/2 e HTTP/3
- ✅ Edge Caching

### Analytics (Opcional)
1. Vá em Analytics
2. Habilite Vercel Analytics
3. Instale o pacote: `npm install @vercel/analytics`

## 🐛 Troubleshooting

### Build Falha
```bash
# Teste o build localmente
cd apps/frontend
npm run build
```

### Variáveis não carregam
- Verifique se todas começam com `NEXT_PUBLIC_`
- Redeploy após adicionar novas variáveis

### 404 em rotas
- Verifique `trailingSlash: true` no next.config.js
- Confirme que `output: 'export'` está configurado

## 📊 Monitoramento

Após o deploy:
- Vercel Logs: https://vercel.com/[seu-projeto]/logs
- Analytics: https://vercel.com/[seu-projeto]/analytics
- Gateway Logs: Monitore seu backend separadamente
