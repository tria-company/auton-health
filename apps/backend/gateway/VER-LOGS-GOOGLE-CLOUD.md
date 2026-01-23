# Como Verificar Logs do Gateway no Google Cloud

## 1. Google Cloud Run (Se o gateway está rodando no Cloud Run)

### Via Console Web:
1. Acesse: https://console.cloud.google.com/run
2. Selecione o projeto correto
3. Clique no serviço `medcall-gateway` (ou nome do seu serviço)
4. Vá na aba **"LOGS"** no topo
5. Filtre por:
   - `[AUTO-SAVE]` - Para ver salvamento de transcrições
   - `[ARRAY-SAVE]` - Para ver salvamento em array
   - `[CALL_SESSION]` - Para ver criação de sessões
   - `[TRANSCRIPTION]` - Para ver conexões OpenAI
   - `ERROR` ou `❌` - Para ver erros

### Via CLI (gcloud):
```bash
# Ver logs em tempo real
gcloud run services logs tail medcall-gateway --follow

# Ver últimas 100 linhas
gcloud run services logs read medcall-gateway --limit 100

# Filtrar por [AUTO-SAVE] ou [ARRAY-SAVE]
gcloud run services logs read medcall-gateway --limit 200 | grep -E "\[AUTO-SAVE\]|\[ARRAY-SAVE\]|\[CALL_SESSION\]|\[TRANSCRIPTION\]"

# Ver apenas erros
gcloud run services logs read medcall-gateway --limit 200 | grep -E "ERROR|❌|Erro"

# Ver logs de uma data específica
gcloud run services logs read medcall-gateway --limit 500 --format="table(timestamp,textPayload)" | grep "2024-"
```

## 2. Google Cloud Build (Se o gateway está sendo buildado)

### Via Console Web:
1. Acesse: https://console.cloud.google.com/cloud-build/builds
2. Selecione o projeto correto
3. Clique no build mais recente
4. Veja os logs do build

### Via CLI:
```bash
# Listar builds recentes
gcloud builds list --limit=5

# Ver logs do último build
gcloud builds log $(gcloud builds list --limit=1 --format="value(id)")
```

## 3. Google Cloud Logging (Logs Consolidados)

### Via Console Web:
1. Acesse: https://console.cloud.google.com/logs
2. Selecione o projeto correto
3. No campo de busca, digite:
   ```
   resource.type="cloud_run_revision"
   resource.labels.service_name="medcall-gateway"
   ```
4. Adicione filtros:
   - `textPayload=~"\[AUTO-SAVE\]"` - Para transcrições
   - `severity>=ERROR` - Para erros
   - `timestamp>="2024-01-01T00:00:00Z"` - Para data específica

### Via CLI:
```bash
# Ver logs consolidados
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=medcall-gateway" --limit=50 --format=json

# Filtrar por [AUTO-SAVE]
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=medcall-gateway AND textPayload=~'\[AUTO-SAVE\]'" --limit=50
```

## 4. O que Procurar nos Logs

### ✅ Se está funcionando, você verá:
```
✅ [CALL_SESSION] Call session criada com sucesso: {id}
✅ [CALL_SESSION] callSessionId salvo na room: {id}
💾 [AUTO-SAVE] Tentando salvar transcrição
💾 [ARRAY-SAVE] Iniciando salvamento
✅ [ARRAY-SAVE] Transcrição adicionada: [doctor] "..."
```

### ❌ Se NÃO está funcionando, procure por:

1. **callSessionId não está sendo criado:**
```
❌ [CALL_SESSION] Erro ao criar call_session
❌ [AUTO-SAVE] callSessionId não disponível
```
**Solução:** Verificar variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY

2. **Supabase não configurado:**
```
❌ [ARRAY-SAVE] Supabase não configurado!
❌ [ARRAY-SAVE] SUPABASE_URL: ❌
```
**Solução:** Configurar variáveis de ambiente no Google Cloud Run

3. **Erro ao buscar/atualizar:**
```
❌ [ARRAY-SAVE] Erro ao buscar transcrição
❌ [ARRAY-SAVE] Erro ao atualizar transcrição
```
**Solução:** Verificar RLS ou se a coluna doctor_name existe

4. **Erro ao criar registro:**
```
❌ [ARRAY-SAVE] Erro ao criar transcrição
❌ [ARRAY-SAVE] Código: 42703 (coluna não existe)
```
**Solução:** Executar SQL para adicionar coluna doctor_name

5. **OpenAI não conecta:**
```
❌ [TRANSCRIPTION] OPENAI_API_KEY não configurada!
❌ [TRANSCRIPTION] Erro OpenAI
```
**Solução:** Verificar OPENAI_API_KEY no Google Cloud Run

## 5. Comandos Rápidos para Debug

```bash
# Ver todas as variáveis de ambiente do serviço
gcloud run services describe medcall-gateway --format="value(spec.template.spec.containers[0].env)"

# Ver apenas SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
gcloud run services describe medcall-gateway --format="value(spec.template.spec.containers[0].env)" | grep -E "SUPABASE|OPENAI"

# Ver logs das últimas 2 horas
gcloud run services logs read medcall-gateway --limit 500 | grep -E "\[AUTO-SAVE\]|\[ARRAY-SAVE\]|\[CALL_SESSION\]"
```

## 6. Exportar Logs para Análise

```bash
# Exportar logs para arquivo
gcloud run services logs read medcall-gateway --limit 1000 > logs-backend.txt

# Filtrar e exportar apenas erros
gcloud run services logs read medcall-gateway --limit 1000 | grep -E "ERROR|❌|Erro" > logs-erros.txt
```

## Próximo Passo

**Envie os logs filtrados** (especialmente as linhas com `[AUTO-SAVE]`, `[ARRAY-SAVE]`, `[CALL_SESSION]`, `[TRANSCRIPTION]`) para identificar o problema específico.

