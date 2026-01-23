/**
 * Script de teste para verificar se o insert de transcrições está funcionando
 * Execute com: npx tsx apps/gateway/test-transcription-insert.ts
 */

import { db, supabase } from './src/config/database';
import { randomUUID } from 'crypto';

async function testTranscriptionInsert() {
  console.log('🧪 Iniciando teste de insert de transcrição...\n');

  // 1. Testar conexão com o banco
  console.log('1️⃣ Testando conexão com o banco...');
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro ao conectar com o banco:', error);
      console.error('Código:', error.code);
      console.error('Mensagem:', error.message);
      console.error('Detalhes:', error.details);
      return;
    }
    console.log('✅ Conexão com o banco OK\n');
  } catch (err) {
    console.error('❌ Erro ao testar conexão:', err);
    return;
  }

  // 2. Criar uma sessão de teste
  console.log('2️⃣ Criando sessão de teste...');
  const testSessionId = randomUUID();
  const testSessionData = {
    id: testSessionId,
    session_type: 'presencial',
    status: 'active',
    started_at: new Date().toISOString(),
    participants: {
      doctor: { id: 'test-doctor', name: 'Dr. Teste' },
      patient: { id: 'test-patient', name: 'Paciente Teste' }
    },
    consent: true,
    metadata: { test: true }
  };

  try {
    const { data: session, error: sessionError } = await supabase
      .from('call_sessions')
      .insert(testSessionData)
      .select()
      .single();

    if (sessionError) {
      console.error('❌ Erro ao criar sessão de teste:', sessionError);
      console.error('Código:', sessionError.code);
      console.error('Mensagem:', sessionError.message);
      console.error('Detalhes:', sessionError.details);
      console.error('Hint:', sessionError.hint);
      return;
    }
    console.log('✅ Sessão de teste criada:', session.id);
    console.log('   Session ID:', testSessionId, '\n');
  } catch (err) {
    console.error('❌ Erro ao criar sessão:', err);
    return;
  }

  // 3. Testar insert de transcrição usando a função createUtterance
  console.log('3️⃣ Testando insert de transcrição...');
  const testTranscription = {
    id: randomUUID(),
    session_id: testSessionId,
    speaker: 'doctor' as const,
    speaker_id: 'doctor',
    text: 'Esta é uma transcrição de teste para verificar se o insert está funcionando.',
    is_final: true,
    start_ms: 0,
    end_ms: 5000,
    confidence: 0.95,
    processing_status: 'completed' as const,
    created_at: new Date().toISOString()
  };

  console.log('Dados da transcrição de teste:');
  console.log(JSON.stringify(testTranscription, null, 2));
  console.log('');

  try {
    const result = await db.createUtterance(testTranscription);
    
    if (result) {
      console.log('✅ Transcrição salva com sucesso!');
      console.log('ID da transcrição:', result.id);
      console.log('Session ID:', result.session_id);
      console.log('Speaker:', result.speaker);
      console.log('Text:', result.text);
      console.log('');
    } else {
      console.error('❌ createUtterance retornou null (sem erro lançado)');
      console.log('Isso pode indicar um problema silencioso no insert.');
      console.log('');
    }
  } catch (err) {
    console.error('❌ Erro ao salvar transcrição:', err);
    if (err instanceof Error) {
      console.error('Stack:', err.stack);
    }
    console.log('');
  }

  // 4. Verificar se a transcrição foi realmente salva
  console.log('4️⃣ Verificando se a transcrição foi salva...');
  try {
    const { data: savedTranscription, error: selectError } = await supabase
      .from('transcriptions_med')
      .select('*')
      .eq('session_id', testSessionId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('❌ Erro ao buscar transcrição:', selectError);
    } else if (savedTranscription) {
      console.log('✅ Transcrição encontrada no banco!');
      console.log('ID:', savedTranscription.id);
      console.log('Speaker:', savedTranscription.speaker);
      console.log('Text:', savedTranscription.text);
      console.log('Created at:', savedTranscription.created_at);
    } else {
      console.log('⚠️ Transcrição não encontrada no banco');
      console.log('Isso pode indicar que o insert falhou silenciosamente.');
    }
  } catch (err) {
    console.error('❌ Erro ao verificar transcrição:', err);
  }

  // 5. Limpar dados de teste (opcional)
  console.log('\n5️⃣ Limpando dados de teste...');
  try {
    // Deletar transcrições de teste
    await supabase
      .from('transcriptions_med')
      .delete()
      .eq('session_id', testSessionId);

    // Deletar sessão de teste
    await supabase
      .from('call_sessions')
      .delete()
      .eq('id', testSessionId);

    console.log('✅ Dados de teste removidos');
  } catch (err) {
    console.warn('⚠️ Erro ao limpar dados de teste (não crítico):', err);
  }

  console.log('\n✅ Teste concluído!');
}

// Executar teste
testTranscriptionInsert()
  .then(() => {
    console.log('\n✅ Script finalizado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Erro fatal no teste:', error);
    process.exit(1);
  });

