# Troubleshooting - Transcrições não salvando em produção

## Problemas Comuns e Soluções

### 1. Variáveis de Ambiente não configuradas

**Sintoma:** Transcrições não são salvas, mas funcionam no localhost

**Solução:**
Verifique se as seguintes variáveis estão configuradas no Google Cloud Build e Vercel:

```bash
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

**Como verificar:**
- Google Cloud Run: Vá em Cloud Run → Seu serviço → Variáveis de ambiente
- Vercel: Vá em Settings → Environment Variables

### 2. RLS (Row Level Security) bloqueando

**Sintoma:** Erros de permissão ao salvar

**Solução:**
Execute este SQL no Supabase SQL Editor para garantir que o service_role pode inserir:

```sql
-- Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'transcriptions_med';

-- Se necessário, criar política para service_role
-- (Normalmente service_role bypassa RLS, mas verifique)
```

### 3. Coluna doctor_name não existe

**Sintoma:** Erro ao inserir: coluna "doctor_name" não existe

**Solução:**
Execute este SQL no Supabase:

```sql
ALTER TABLE public.transcriptions_med 
ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(255) NULL;

CREATE INDEX IF NOT EXISTS idx_transcriptions_med_doctor_name 
ON public.transcriptions_med(doctor_name);
```

### 4. Verificar logs em produção

**Google Cloud Run:**
```bash
# Ver logs do serviço
gcloud run services logs read medcall-gateway --limit 50
```

**Vercel:**
- Vá em Deployments → Seu deployment → Functions → Ver logs

**O que procurar nos logs:**
- `❌ [ARRAY-SAVE]` - Erros ao salvar
- `⚠️ [AUTO-SAVE]` - Avisos
- `✅ [ARRAY-SAVE]` - Sucesso
- `❌ [CONFIG]` - Problemas de configuração

### 5. Teste de conexão

Acesse o endpoint de health check:
```
GET https://seu-gateway.com/api/health/detailed
```

Deve retornar:
```json
{
  "status": "healthy",
  "database": {
    "status": "connected"
  }
}
```

### 6. Verificar se callSessionId está sendo criado

Nos logs, procure por:
```
✅ [CALL_SESSION] Criada no banco: {sessionId}
```

Se não aparecer, o problema está na criação da sessão, não no salvamento de transcrições.

## Checklist de Debug

- [ ] Variáveis de ambiente configuradas (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Coluna doctor_name existe na tabela transcriptions_med
- [ ] RLS não está bloqueando (service_role deve bypassar)
- [ ] Logs mostram tentativas de salvamento
- [ ] callSessionId está sendo criado corretamente
- [ ] Health check retorna database como "connected"

## Logs Adicionados

O código agora tem logs detalhados que mostram:
- Se Supabase está configurado
- Se encontrou registro existente ou está criando novo
- Erros detalhados com código, mensagem e hint
- Dados tentados em caso de erro

Verifique os logs em produção para identificar o problema específico.

