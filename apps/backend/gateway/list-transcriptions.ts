/**
 * Script para listar todas as transcrições salvas no banco
 * Execute com: npx tsx apps/gateway/list-transcriptions.ts
 */

import { supabase } from './src/config/database';

async function listTranscriptions() {
  console.log('📋 Listando todas as transcrições no banco...\n');

  // 1. Contar total de transcrições
  console.log('1️⃣ Contando transcrições...');
  const { count, error: countError } = await supabase
    .from('transcriptions_med')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('❌ Erro ao contar:', countError);
    return;
  }

  console.log(`✅ Total de transcrições: ${count || 0}\n`);

  if (count === 0) {
    console.log('⚠️ Nenhuma transcrição encontrada no banco.');
    console.log('\n💡 Possíveis causas:');
    console.log('   - RLS (Row Level Security) bloqueando a visualização');
    console.log('   - Dados foram deletados');
    console.log('   - Problema de conexão/schema');
    return;
  }

  // 2. Listar últimas 20 transcrições
  console.log('2️⃣ Listando últimas 20 transcrições...\n');
  const { data: transcriptions, error: listError } = await supabase
    .from('transcriptions_med')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (listError) {
    console.error('❌ Erro ao listar:', listError);
    return;
  }

  if (!transcriptions || transcriptions.length === 0) {
    console.log('⚠️ Nenhuma transcrição retornada (mesmo com count > 0)');
    console.log('   Isso indica problema de RLS ou permissões');
    return;
  }

  console.log(`✅ Encontradas ${transcriptions.length} transcrição(ões):\n`);
  
  transcriptions.forEach((t, index) => {
    console.log(`${index + 1}. [${t.speaker}] ${t.text?.substring(0, 60)}${t.text && t.text.length > 60 ? '...' : ''}`);
    console.log(`   ID: ${t.id}`);
    console.log(`   Session ID: ${t.session_id}`);
    console.log(`   Criado em: ${t.created_at}`);
    console.log(`   Confiança: ${t.confidence || 'N/A'}`);
    console.log('');
  });

  // 3. Verificar sessões relacionadas
  console.log('3️⃣ Verificando sessões relacionadas...\n');
  const sessionIds = [...new Set(transcriptions.map(t => t.session_id))];
  
  for (const sessionId of sessionIds.slice(0, 5)) {
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .select('id, session_type, status, started_at')
      .eq('id', sessionId)
      .maybeSingle();

    if (session) {
      console.log(`   Session ${sessionId}:`);
      console.log(`      Tipo: ${session.session_type}`);
      console.log(`      Status: ${session.status}`);
      console.log(`      Iniciada em: ${session.started_at}`);
      console.log('');
    }
  }

  console.log('✅ Listagem concluída!');
}

listTranscriptions()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });

