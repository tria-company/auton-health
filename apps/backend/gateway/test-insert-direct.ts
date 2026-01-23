/**
 * Teste DIRETO de insert - sem limpar nada, sem usar a função db.createUtterance
 * Testa diretamente o Supabase para ver se há problema de RLS ou conexão
 */

import { supabase } from './src/config/database';
import { randomUUID } from 'crypto';

async function testDirectInsert() {
  console.log('🧪 Teste DIRETO de insert no Supabase...\n');

  // 1. Verificar conexão
  console.log('1️⃣ Verificando conexão...');
  const { data: testData, error: testError } = await supabase
    .from('call_sessions')
    .select('id')
    .limit(1);
  
  if (testError) {
    console.error('❌ Erro na conexão:', testError);
    return;
  }
  console.log('✅ Conexão OK\n');

  // 2. Criar sessão de teste
  console.log('2️⃣ Criando sessão de teste...');
  const sessionId = randomUUID();
  
  const { data: session, error: sessionError } = await supabase
    .from('call_sessions')
    .insert({
      id: sessionId,
      session_type: 'presencial',
      status: 'active',
      started_at: new Date().toISOString(),
      participants: { doctor: { id: 'test', name: 'Test' }, patient: { id: 'test', name: 'Test' } },
      consent: true,
      metadata: { test: true }
    })
    .select()
    .single();

  if (sessionError) {
    console.error('❌ Erro ao criar sessão:', sessionError);
    console.error('Código:', sessionError.code);
    console.error('Mensagem:', sessionError.message);
    console.error('Detalhes:', sessionError.details);
    return;
  }
  console.log('✅ Sessão criada:', session.id);
  console.log('   Session ID:', sessionId, '\n');

  // 3. Insert DIRETO na tabela transcriptions_med
  console.log('3️⃣ Fazendo insert DIRETO na tabela transcriptions_med...');
  const transcriptionId = randomUUID();
  
  const transcriptionData = {
    id: transcriptionId,
    session_id: sessionId,
    speaker: 'doctor',
    speaker_id: 'doctor',
    text: 'TESTE DIRETO - Esta transcrição foi inserida diretamente no Supabase para testar.',
    is_final: true,
    start_ms: 0,
    end_ms: 5000,
    confidence: 0.95,
    processing_status: 'completed',
    created_at: new Date().toISOString()
  };

  console.log('Dados a inserir:');
  console.log(JSON.stringify(transcriptionData, null, 2));
  console.log('');

  const { data: inserted, error: insertError } = await supabase
    .from('transcriptions_med')
    .insert(transcriptionData)
    .select()
    .single();

  if (insertError) {
    console.error('❌ ERRO AO INSERIR:');
    console.error('Código:', insertError.code);
    console.error('Mensagem:', insertError.message);
    console.error('Detalhes:', insertError.details);
    console.error('Hint:', insertError.hint);
    console.error('\n💡 Possíveis causas:');
    console.error('   - RLS (Row Level Security) bloqueando o insert');
    console.error('   - Foreign key constraint (session_id não existe)');
    console.error('   - Campos obrigatórios faltando');
    console.error('   - Tipo de dados incorreto');
    return;
  }

  console.log('✅ INSERT REALIZADO COM SUCESSO!');
  console.log('ID inserido:', inserted.id);
  console.log('Session ID:', inserted.session_id);
  console.log('Speaker:', inserted.speaker);
  console.log('Text:', inserted.text);
  console.log('');

  // 4. Verificar se foi realmente salvo
  console.log('4️⃣ Verificando se está no banco...');
  const { data: verify, error: verifyError } = await supabase
    .from('transcriptions_med')
    .select('*')
    .eq('id', transcriptionId)
    .maybeSingle();

  if (verifyError) {
    console.error('❌ Erro ao verificar:', verifyError);
  } else if (verify) {
    console.log('✅ Transcrição encontrada no banco!');
    console.log('   ID:', verify.id);
    console.log('   Text:', verify.text);
    console.log('   Created at:', verify.created_at);
  } else {
    console.log('⚠️ Transcrição NÃO encontrada (mesmo após insert bem-sucedido)');
    console.log('   Isso pode indicar problema de RLS ou permissões');
  }

  console.log('\n📊 Resumo:');
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Transcription ID: ${transcriptionId}`);
  console.log('\n💡 Verifique no Supabase se a transcrição aparece na tabela transcriptions_med');
  console.log('   Se não aparecer, pode ser problema de RLS (Row Level Security)');
}

testDirectInsert()
  .then(() => {
    console.log('\n✅ Teste finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal:', error);
    process.exit(1);
  });

