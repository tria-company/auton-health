/**
 * Script de controle para configurar o sistema de áudio em tempo real
 * Uso: node control-audio.js [comando] [parâmetros]
 */

const commands = {
  'enable-simulation': () => {
    console.log('📝 Para habilitar simulação:');
    console.log('curl -X POST http://localhost:3001/debug/asr/simulation/enable');
  },
  
  'disable-simulation': () => {
    console.log('🔇 Para desabilitar simulação:');
    console.log('curl -X POST http://localhost:3001/debug/asr/simulation/disable');
  },
  
  'set-vad': (threshold) => {
    if (!threshold) {
      console.log('❌ Uso: node control-audio.js set-vad [threshold]');
      console.log('Exemplo: node control-audio.js set-vad 0.05');
      return;
    }
    console.log(`🎛️ Para definir VAD threshold para ${threshold}:`);
    console.log(`curl -X POST http://localhost:3001/debug/audio/vad/${threshold}`);
  },
  
  'set-duration': (duration) => {
    if (!duration) {
      console.log('❌ Uso: node control-audio.js set-duration [milliseconds]');
      console.log('Exemplo: node control-audio.js set-duration 800');
      return;
    }
    console.log(`⏱️ Para definir duração mínima para ${duration}ms:`);
    console.log(`curl -X POST http://localhost:3001/debug/audio/duration/${duration}`);
  },
  
  'stats': () => {
    console.log('📊 Para ver estatísticas:');
    console.log('curl http://localhost:3001/debug/audio/stats');
  },
  
  'config': () => {
    console.log('⚙️ Para ver configuração atual:');
    console.log('curl http://localhost:3001/debug/audio/config');
  },
  
  'help': () => {
    console.log('🔧 Comandos disponíveis:');
    console.log('');
    console.log('node control-audio.js enable-simulation   - Habilitar simulação de transcrição');
    console.log('node control-audio.js disable-simulation  - Desabilitar simulação de transcrição');
    console.log('node control-audio.js set-vad [threshold]  - Definir threshold de VAD (0.001-1.0)');
    console.log('node control-audio.js set-duration [ms]   - Definir duração mínima de voz');
    console.log('node control-audio.js stats               - Ver estatísticas do sistema');
    console.log('node control-audio.js config              - Ver configuração atual');
    console.log('');
    console.log('🎯 Configurações recomendadas:');
    console.log('- VAD Threshold: 0.05-0.1 (mais alto = menos sensível)');
    console.log('- Duração mínima: 500-1000ms (evita ruídos curtos)');
    console.log('');
    console.log('🔍 Diagnóstico de problemas:');
    console.log('- Muitas transcrições falsas: aumentar VAD threshold');
    console.log('- Não detecta voz baixa: diminuir VAD threshold');
    console.log('- Detecta ruídos curtos: aumentar duração mínima');
  }
};

const command = process.argv[2];
const param = process.argv[3];

if (!command || !commands[command]) {
  commands.help();
} else {
  commands[command](param);
}
