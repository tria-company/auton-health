/**
 * Script de teste para verificar se o insert de transcrições está funcionando
 * Esta versão MANTÉM os dados no banco para você verificar
 * Execute com: npx tsx apps/gateway/test-transcription-insert-keep.ts
 */

import { db, supabase } from './src/config/database';
import { randomUUID } from 'crypto';

async function testTranscriptionInsert() {
  console.log('🧪 Iniciando teste de insert de transcrição (dados serão mantidos)...\n');

  // 1. Testar conexão com o banco
  console.log('1️⃣ Testando conexão com o banco...');
  try {
    const { data, error } = await supabase
      .from('call_sessions')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Erro ao conectar com o banco:', error);
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
    metadata: { test: true, created_by: 'test-script' }
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

  // 3. Criar múltiplas transcrições de teste (médico e paciente)
  console.log('3️⃣ Criando transcrições de teste...\n');

  const testTranscriptions = [
    {
      speaker: 'doctor' as const,
      text: 'Olá, como você está se sentindo hoje?',
      start_ms: 0,
      end_ms: 3000,
      confidence: 0.98
    },
    {
      speaker: 'patient' as const,
      text: 'Olá doutor, estou me sentindo um pouco cansado e com dor de cabeça.',
      start_ms: 3000,
      end_ms: 8000,
      confidence: 0.95
    },
    {
      speaker: 'doctor' as const,
      text: 'Entendo. Há quanto tempo você está com esses sintomas?',
      start_ms: 8000,
      end_ms: 12000,
      confidence: 0.97
    },
    {
      speaker: 'patient' as const,
      text: 'Faz uns três dias que começou. A dor de cabeça é constante.',
      start_ms: 12000,
      end_ms: 18000,
      confidence: 0.94
    },
    {
      speaker: 'doctor' as const,
      text: 'Vou prescrever um medicamento para ajudar com a dor. Tome conforme as instruções.',
      start_ms: 18000,
      end_ms: 25000,
      confidence: 0.96
    }
  ];

  const savedTranscriptions = [];

  for (let i = 0; i < testTranscriptions.length; i++) {
    const testData = testTranscriptions[i];
    const transcription = {
      id: randomUUID(),
      session_id: testSessionId,
      speaker: testData.speaker,
      speaker_id: testData.speaker,
      text: testData.text,
      is_final: true,
      start_ms: testData.start_ms,
      end_ms: testData.end_ms,
      confidence: testData.confidence,
      processing_status: 'completed' as const,
      created_at: new Date().toISOString()
    };

    console.log(`   📝 Criando transcrição ${i + 1}/${testTranscriptions.length}:`);
    console.log(`      Speaker: ${testData.speaker}`);
    console.log(`      Text: "${testData.text}"`);

    try {
      const result = await db.createUtterance(transcription);
      
      if (result) {
        console.log(`      ✅ Salva! ID: ${result.id}\n`);
        savedTranscriptions.push(result);
      } else {
        console.log(`      ❌ Falhou (retornou null)\n`);
      }
    } catch (err) {
      console.error(`      ❌ Erro:`, err, '\n');
    }
  }

  // 4. Verificar todas as transcrições salvas
  console.log('4️⃣ Verificando transcrições salvas no banco...\n');
  try {
    const { data: savedTranscriptions, error: selectError } = await supabase
      .from('transcriptions_med')
      .select('*')
      .eq('session_id', testSessionId)
      .order('start_ms', { ascending: true });

    if (selectError) {
      console.error('❌ Erro ao buscar transcrições:', selectError);
    } else if (savedTranscriptions && savedTranscriptions.length > 0) {
      console.log(`✅ ${savedTranscriptions.length} transcrição(ões) encontrada(s) no banco:\n`);
      savedTranscriptions.forEach((t, index) => {
        console.log(`   ${index + 1}. [${t.speaker}] ${t.text}`);
        console.log(`      ID: ${t.id}`);
        console.log(`      Tempo: ${t.start_ms}ms - ${t.end_ms}ms`);
        console.log(`      Confiança: ${t.confidence}`);
        console.log(`      Criado em: ${t.created_at}\n`);
      });
    } else {
      console.log('⚠️ Nenhuma transcrição encontrada no banco');
    }
  } catch (err) {
    console.error('❌ Erro ao verificar transcrições:', err);
  }

  console.log('\n✅ Teste concluído!');
  console.log(`\n📊 Resumo:`);
  console.log(`   Session ID: ${testSessionId}`);
  console.log(`   Transcrições criadas: ${testTranscriptions.length}`);
  console.log(`   Transcrições salvas: ${savedTranscriptions.length}`);
  console.log(`\n💡 Os dados foram MANTIDOS no banco para você verificar.`);
  console.log(`   Para limpar, execute: DELETE FROM transcriptions_med WHERE session_id = '${testSessionId}';`);
  console.log(`   E depois: DELETE FROM call_sessions WHERE id = '${testSessionId}';`);
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

