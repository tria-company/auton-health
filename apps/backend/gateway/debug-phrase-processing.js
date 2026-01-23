/**
 * Debug - Identificar por que ainda está processando múltiplos chunks
 */

console.log('🔍 DEBUG - POR QUE AINDA MÚLTIPLOS CARDS?\n');

console.log('🎯 Configurações aplicadas:');
console.log('✅ phraseEndSilenceMs: 6000ms (6 segundos)');
console.log('✅ disablePartialProcessing: true');
console.log('✅ Buffer cheio: DESABILITADO');
console.log('✅ Buffer órfão: DESABILITADO');
console.log('✅ flushPendingBuffers: DESABILITADO');

console.log('\n📊 Única forma de processar agora:');
console.log('🔚 APENAS: Silêncio de 6 segundos → flushPhraseBuffer()');
console.log('🔚 APENAS: Parar gravação → flushPendingPhrases()');

console.log('\n🔍 O que procurar nos logs:');
console.log('✅ BOM: "🎬 Iniciando nova frase: doctor"');
console.log('✅ BOM: "🔚 Finalizando frase após 6000ms de silêncio: doctor"');
console.log('✅ BOM: "🎯 FRASE COMPLETA PROCESSADA: doctor - 8500ms"');

console.log('\n❌ SINAIS DE PROBLEMA:');
console.log('❌ "✅ Buffer processado:" (não deveria aparecer)');
console.log('❌ Múltiplos "🎯 FRASE COMPLETA PROCESSADA" muito rápidos');
console.log('❌ Whisper sendo chamado antes de 6 segundos de silêncio');

console.log('\n🧪 Teste:');
console.log('1. Falar: "Esta é uma frase longa para testar o agrupamento completo"');
console.log('2. Parar de falar e ficar 6 segundos em silêncio');
console.log('3. Aguardar log: "🔚 Finalizando frase após 6000ms"');
console.log('4. Ver APENAS UM card aparecer');

console.log('\n📋 Se ainda aparecer múltiplos cards:');
console.log('- Verificar se outros métodos estão chamando Whisper');
console.log('- Confirmar que são chamadas diferentes vs. mesmo áudio processado várias vezes');
console.log('- Verificar timestamps das transcrições');

console.log('\n🔬 Para debug adicional:');
console.log('- Abrir console do navegador');
console.log('- Verificar quantas vezes "Frontend recebeu transcrição" aparece');
console.log('- Verificar se IDs das utterances são diferentes');

console.log('\n🚀 COM 6 SEGUNDOS DE SILÊNCIO DEVE FUNCIONAR!');
