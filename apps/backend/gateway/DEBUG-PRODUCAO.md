# Debug - Transcrições não salvando em produção

## Logs Adicionados

Agora o código tem logs muito mais detalhados que vão mostrar exatamente onde está falhando:

### 1. Logs de Verificação Inicial
```
🔍 [AUTO-SAVE] Verificando condições para salvar
💾 [ARRAY-SAVE] Iniciando salvamento
```

### 2. Logs de Call Session
```
💾 [CALL_SESSION] Tentando criar call_session
✅ [CALL_SESSION] Call session criada com sucesso
❌ [CALL_SESSION] Erro ao criar call_session
```

### 3. Logs de Salvamento
```
💾 [AUTO-SAVE] Tentando salvar transcrição
💾 [ARRAY-SAVE] Iniciando salvamento
✅ [ARRAY-SAVE] Registro existente encontrado
📝 [ARRAY-SAVE] Nenhum registro encontrado, criando novo
✅ [ARRAY-SAVE] Transcrição adicionada
❌ [ARRAY-SAVE] Erro ao buscar/atualizar/criar
```

## Como Verificar os Logs

### Google Cloud Run
```bash
# Ver logs em tempo real
gcloud run services logs tail medcall-gateway --follow

# Ver últimas 100 linhas
gcloud run services logs read medcall-gateway --limit 100

# Filtrar por [AUTO-SAVE] ou [ARRAY-SAVE]
gcloud run services logs read medcall-gateway --limit 200 | grep -E "\[AUTO-SAVE\]|\[ARRAY-SAVE\]|\[CALL_SESSION\]"
```

### Vercel
- Vá em: Deployments → Seu deployment → Functions → Ver logs
- Procure por: `[AUTO-SAVE]`, `[ARRAY-SAVE]`, `[CALL_SESSION]`

## O que Procurar nos Logs

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

## Checklist Rápido

- [ ] Verificar logs em produção
- [ ] Procurar por `[AUTO-SAVE]` ou `[ARRAY-SAVE]`
- [ ] Verificar se aparece `callSessionId não disponível`
- [ ] Verificar se aparece `Supabase não configurado`
- [ ] Verificar se há erros de coluna não existe
- [ ] Verificar variáveis de ambiente no Google Cloud Run

## Próximo Passo

**Envie os logs de produção** (especialmente as linhas com `[AUTO-SAVE]`, `[ARRAY-SAVE]`, `[CALL_SESSION]`) para identificar o problema específico.

