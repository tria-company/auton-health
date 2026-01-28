#!/usr/bin/env node

// Log imediato para confirmar que o processo está sendo executado
console.log('🚀 [INDEX] Processo iniciado');
console.log('🚀 [INDEX] Node version:', process.version);
console.log('🚀 [INDEX] Process PID:', process.pid);
console.log('🚀 [INDEX] PORT env:', process.env.PORT);

// Carregar variáveis de ambiente
import * as dotenv from 'dotenv';
dotenv.config();

console.log('🚀 [INDEX] Dotenv carregado');

// ✅ Verificar configuração do Supabase antes de iniciar
import { config } from './config';
import { testDatabaseConnection } from './config/database';

console.log('🚀 [INDEX] Config importado, importando servidor...');

// Importar o servidor configurado IMEDIATAMENTE
// Isso garante que o servidor comece a escutar na porta o mais rápido possível
import './server';

console.log('🚀 [INDEX] Servidor importado');

// Função para verificar conexão com banco (executa APÓS o servidor iniciar)
async function verifyDatabaseConnection() {
  console.log('🔍 [STARTUP] Verificando conexão com banco de dados...');
  console.log('🔍 [STARTUP] SUPABASE_URL:', config.SUPABASE_URL ? '✅ Configurado' : '❌ Não configurado');
  console.log('🔍 [STARTUP] SUPABASE_SERVICE_ROLE_KEY:', config.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '❌ Não configurado');
  
  const isConnected = await testDatabaseConnection();
  if (!isConnected) {
    console.error('❌ [STARTUP] Falha na conexão com banco de dados!');
    console.error('❌ [STARTUP] Verifique as variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
    // Não bloquear startup, mas avisar
  } else {
    console.log('✅ [STARTUP] Conexão com banco de dados OK');
  }
  return isConnected;
}

// Verificar conexão APÓS importar o servidor (não bloqueia startup)
// Aumentado para 5 segundos para garantir que o servidor já iniciou
setTimeout(() => {
  verifyDatabaseConnection().catch((error) => {
    console.error('❌ [STARTUP] Erro ao verificar conexão:', error);
  });
}, 5000); // Aguarda 5 segundos para servidor iniciar completamente

// Tratamento de erros não capturados
// ⚠️ Em produção, não matar o processo imediatamente para permitir que o servidor inicie
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [ERROR] Unhandled Rejection at:', promise, 'reason:', reason);
  // Em produção, apenas logar o erro, não matar o processo
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});

process.on('uncaughtException', (error) => {
  console.error('❌ [ERROR] Uncaught Exception:', error);
  // Em produção, apenas logar o erro, não matar o processo imediatamente
  if (process.env.NODE_ENV === 'development') {
    process.exit(1);
  }
});