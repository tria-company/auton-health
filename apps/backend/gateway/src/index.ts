#!/usr/bin/env node

// Carregar variáveis de ambiente
import * as dotenv from 'dotenv';
dotenv.config();

// ✅ Verificar configuração do Supabase antes de iniciar
import { config } from './config';
import { testDatabaseConnection } from './config/database';

// Importar o servidor configurado IMEDIATAMENTE
// Isso garante que o servidor comece a escutar na porta o mais rápido possível
try {
  import('./server').catch((error) => {
    console.error('❌ [STARTUP] Erro ao importar servidor:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ [STARTUP] Erro ao importar servidor (síncrono):', error);
  process.exit(1);
}

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
setTimeout(() => {
  verifyDatabaseConnection().catch((error) => {
    console.error('❌ [STARTUP] Erro ao verificar conexão:', error);
  });
}, 1000); // Aguarda 1 segundo para servidor iniciar

// Tratamento de erros não capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});