# Configuração para Vercel

## Variáveis de Ambiente Necessárias

### No Gateway (Google Cloud Run / Vercel Functions)

As seguintes variáveis de ambiente devem estar configuradas:

```bash
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

# Azure OpenAI (OBRIGATÓRIO para transcrições)
AZURE_OPENAI_ENDPOINT=https://seu-recurso.cognitiveservices.azure.com
AZURE_OPENAI_API_KEY=sua-api-key-azure
AZURE_OPENAI_CHAT_DEPLOYMENT=gpt-4o-mini
AZURE_OPENAI_WHISPER_DEPLOYMENT=whisper
AZURE_OPENAI_REALTIME_DEPLOYMENT=gpt-realtime-mini

# API Versions (opcional - usa defaults)
AZURE_OPENAI_CHAT_API_VERSION=2025-01-01-preview
AZURE_OPENAI_WHISPER_API_VERSION=2024-06-01
AZURE_OPENAI_REALTIME_API_VERSION=2024-10-01-preview

# Outras
NODE_ENV=production
PORT=3001
```

### No Frontend (Vercel)

As seguintes variáveis de ambiente devem estar configuradas:

```bash
# Gateway URL (OBRIGATÓRIO)
NEXT_PUBLIC_GATEWAY_HTTP_URL=https://seu-gateway.run.app
# ou
NEXT_PUBLIC_GATEWAY_URL=https://seu-gateway.run.app

# Outras variáveis do frontend
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## Verificação de Problemas

### 1. WebSocket não conecta

**Sintoma:** `WebSocket connection to 'wss://...' failed`

**Causas possíveis:**
- `NEXT_PUBLIC_GATEWAY_HTTP_URL` não está configurada na Vercel
- Gateway não está rodando ou não aceita WebSocket
- URL do gateway está incorreta

**Solução:**
1. Verificar se `NEXT_PUBLIC_GATEWAY_HTTP_URL` está configurada na Vercel
2. Verificar se o gateway está rodando e acessível
3. Verificar se o gateway suporta WebSocket (deve usar Socket.IO)

### 2. "Não conectado à Azure OpenAI"

**Sintoma:** `[TRANSCRIPTION ERROR] Erro: Azure OpenAI não configurado`

**Causas possíveis:**
- `AZURE_OPENAI_ENDPOINT` ou `AZURE_OPENAI_API_KEY` não estão configuradas no gateway
- Gateway não está conseguindo conectar à Azure OpenAI
- WebSocket do gateway não está funcionando

**Solução:**
1. Verificar se variáveis Azure estão configuradas no gateway
2. Verificar logs do gateway para erros de conexão Azure
3. Verificar se o gateway está processando eventos `transcription:connect`

### 3. Transcrições não salvam no banco

**Sintoma:** Transcrições aparecem na tela mas não salvam no banco

**Causas possíveis:**
- `SUPABASE_URL` ou `SUPABASE_SERVICE_ROLE_KEY` não configuradas no gateway
- RLS (Row Level Security) bloqueando inserts
- `callSessionId` não está sendo criado

**Solução:**
1. Verificar variáveis Supabase no gateway
2. Verificar logs do gateway para erros de insert
3. Verificar se `callSessionId` está sendo criado corretamente

## Como Verificar Logs

### Gateway (Google Cloud Run)
```bash
gcloud run services logs read medcall-gateway --limit 200 | grep -E "\[AUTO-SAVE\]|\[ARRAY-SAVE\]|\[CALL_SESSION\]|Azure|WebSocket"
```

### Frontend (Vercel)
- Vá em: Deployments → Seu deployment → Functions → Ver logs
- Procure por: `WebSocket`, `transcription`, `Azure`

## Checklist de Deploy

- [ ] Gateway tem `AZURE_OPENAI_ENDPOINT` e `AZURE_OPENAI_API_KEY` configuradas
- [ ] Gateway tem `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` configuradas
- [ ] Frontend tem `NEXT_PUBLIC_GATEWAY_HTTP_URL` configurada
- [ ] Gateway está acessível e respondendo
- [ ] WebSocket está funcionando (testar conexão)
- [ ] Logs não mostram erros de conexão
