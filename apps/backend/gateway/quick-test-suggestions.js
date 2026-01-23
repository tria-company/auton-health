/**
 * Script de teste rápido para verificar se as sugestões estão sendo geradas
 * Execute este script para testar o sistema de sugestões
 */

const { suggestionService } = require('./src/services/suggestionService');
const { db } = require('./src/config/database');

async function quickTest() {
  console.log('🧪 Teste rápido do sistema de sugestões...\n');

  try {
    // 1. Verificar se o serviço está habilitado
    const stats = suggestionService.getServiceStats();
    console.log('📊 Status do serviço:', stats.isEnabled ? '✅ Habilitado' : '❌ Desabilitado');

    if (!stats.isEnabled) {
      console.log('⚠️ Serviço desabilitado - verifique OPENAI_API_KEY');
      return;
    }

    // 2. Criar dados de teste
    const testSessionId = 'test-session-' + Date.now();
    const testUtterances = [
      {
        id: 'test-1',
        speaker: 'patient',
        text: 'Doutor, estou com uma dor muito forte no peito há dois dias.',
        timestamp: new Date().toISOString(),
        confidence: 0.9
      },
      {
        id: 'test-2',
        speaker: 'doctor',
        text: 'Entendo. Você pode me dizer onde exatamente dói?',
        timestamp: new Date().toISOString(),
        confidence: 0.95
      },
      {
        id: 'test-3',
        speaker: 'patient',
        text: 'Dói aqui no meio do peito, como se fosse um aperto. E às vezes a dor vai para o braço esquerdo.',
        timestamp: new Date().toISOString(),
        confidence: 0.88
      }
    ];

    // 3. Criar sessão de teste
    console.log('\n📝 Criando sessão de teste...');
    const session = await db.createSession({
      id: testSessionId,
      consultation_id: 'test-consultation',
      session_type: 'presencial',
      status: 'active',
      created_at: new Date().toISOString()
    });

    if (!session) {
      console.log('❌ Falha ao criar sessão de teste');
      return;
    }

    console.log('✅ Sessão criada:', session.id);

    // 4. Criar utterances de teste
    console.log('\n📝 Criando utterances de teste...');
    for (const utterance of testUtterances) {
      const created = await db.createUtterance({
        id: utterance.id,
        session_id: testSessionId,
        speaker: utterance.speaker,
        text: utterance.text,
        confidence: utterance.confidence,
        start_ms: Date.now() - 300000,
        end_ms: Date.now() - 200000,
        is_final: true,
        created_at: utterance.timestamp
      });

      if (created) {
        console.log(`✅ Utterance criada: [${utterance.speaker}] "${utterance.text.substring(0, 50)}..."`);
      }
    }

    // 5. Testar geração de sugestões
    console.log('\n🤖 Testando geração de sugestões...');
    const context = {
      sessionId: testSessionId,
      patientName: 'Paciente Teste',
      sessionDuration: 5,
      consultationType: 'presencial',
      utterances: testUtterances,
      specialty: 'clinica_geral'
    };

    const suggestions = await suggestionService.generateSuggestions(context);

    if (suggestions && suggestions.suggestions.length > 0) {
      console.log(`✅ ${suggestions.suggestions.length} sugestões geradas:`);
      
      suggestions.suggestions.forEach((suggestion, index) => {
        console.log(`\n   ${index + 1}. [${suggestion.type.toUpperCase()}] ${suggestion.content}`);
        console.log(`      Prioridade: ${suggestion.priority} | Confiança: ${Math.round(suggestion.confidence * 100)}%`);
        console.log(`      Fonte: ${suggestion.source || 'N/A'}`);
      });

      console.log('\n📊 Análise de contexto:');
      console.log(`   Fase: ${suggestions.context_analysis.phase}`);
      console.log(`   Urgência: ${suggestions.context_analysis.urgency_level}`);
      console.log(`   Sintomas: ${suggestions.context_analysis.symptoms.join(', ')}`);

    } else {
      console.log('❌ Nenhuma sugestão foi gerada');
      console.log('💡 Verifique se:');
      console.log('   - OPENAI_API_KEY está configurada');
      console.log('   - Banco de dados está acessível');
      console.log('   - Protocolos médicos estão carregados');
    }

    // 6. Limpeza
    console.log('\n🧹 Limpando dados de teste...');
    suggestionService.clearSessionCache(testSessionId);
    console.log('✅ Teste concluído!');

  } catch (error) {
    console.error('❌ Erro durante o teste:', error);
  }
}

// Executar teste
if (require.main === module) {
  quickTest().catch(console.error);
}

module.exports = { quickTest };
