import dotenv from 'dotenv';
import { z } from 'zod';
import path from 'path';

// Carrega variáveis de ambiente do próprio gateway
dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // App Settings
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(process.env.PORT ? parseInt(process.env.PORT) : 8080),
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // LiveKit removido - usando WebRTC direto

  // Supabase
  SUPABASE_URL: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),



  // Security
  // Security
  // Tenta pegar JWT_SECRET ou SUPABASE_JWT_SECRET do env, ou usa default
  JWT_SECRET: z.string().default(process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || 'default-jwt-secret-change-me-in-production-12345678'),
  ENCRYPTION_KEY: z.string().default('default-encryption-key-change-me-prod-12345678'),


  // Redis (opcional por enquanto)
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000), // 15 minutos
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(5000),

  // CORS
  CORS_ORIGINS: z.string().optional(), // Lista de origens separadas por vírgula
  CORS_ALLOW_ALL: z.coerce.boolean().default(false), // PERIGOSO: permite todas as origens

  // Helmet/Security
  HELMET_ENABLED: z.coerce.boolean().default(true),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SENTRY_DSN: z.string().optional(),

  // Medical & Compliance
  ENABLE_RECORDING: z.coerce.boolean().default(false),
  DATA_RETENTION_DAYS: z.coerce.number().default(30),
  HIPAA_COMPLIANT_MODE: z.coerce.boolean().default(true),

  // Audio Processing
  VAD_SILENCE_THRESHOLD_MS: z.coerce.number().default(1200),
  MAX_AUDIO_DURATION_MS: z.coerce.number().default(300000), // 5 minutos
  AUDIO_SAMPLE_RATE: z.coerce.number().default(16000),

  // Evolution API
  EVO_SERVICE_URL: z.string().default(''),
  EVO_INSTANCE_NAME: z.string().default(''),
  EVO_APIKEY: z.string().default(''),

  // AI & RAG Settings


  // Development
  DEBUG_AUDIO: z.coerce.boolean().default(false),
  MOCK_ASR: z.coerce.boolean().default(false),
  MOCK_LLM: z.coerce.boolean().default(false),
});

// Valida e exporta as configurações
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);

    // ✅ Log de configuração (sem mostrar valores sensíveis)
    console.log('🔧 [CONFIG] Ambiente:', parsed.NODE_ENV);
    console.log('🔧 [CONFIG] PORT:', parsed.PORT);
    console.log('🔧 [CONFIG] SUPABASE_URL:', parsed.SUPABASE_URL ? '✅ Configurado' : '⚠️ Usando default');
    console.log('🔧 [CONFIG] SUPABASE_SERVICE_ROLE_KEY:', parsed.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurado' : '⚠️ Usando default');

    // Avisos para variáveis críticas não configuradas
    if (!parsed.SUPABASE_URL) {
      console.warn('⚠️ [CONFIG] SUPABASE_URL não configurada - funcionalidades limitadas');
    }


    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(err => `${err.path.join('.')}: ${err.message}`);
      console.error('❌ [CONFIG] Erro de configuração:');
      console.error(missingVars.join('\n'));
      console.warn('⚠️ [CONFIG] Continuando com configurações padrão - configure as variáveis de ambiente no Cloud Run!');
      // NÃO lançar erro - permitir que o servidor inicie
      return envSchema.parse({});
    }
    throw error;
  }
}

export const config = validateEnv();

// Configurações derivadas
export const isDevelopment = config.NODE_ENV === 'development';
export const isProduction = config.NODE_ENV === 'production';
export const isTest = config.NODE_ENV === 'test';

// Configurações específicas por ambiente
export const corsOrigins = isDevelopment
  ? ['http://localhost:3000', 'http://localhost:3001']
  : [config.FRONTEND_URL];

// Configurações de logging
export const logConfig = {
  level: config.LOG_LEVEL,
  format: isDevelopment ? 'dev' : 'combined',
  enableConsole: isDevelopment,
  enableFile: isProduction,
};

// Configurações de rate limiting
export const rateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: 'Muitas requisições, tente novamente em alguns minutos.',
  standardHeaders: true,
  legacyHeaders: false,
};

// Configurações de CORS
export const corsConfig = {
  origins: config.CORS_ORIGINS,
  allowAll: config.CORS_ALLOW_ALL,
};

// Configurações de Helmet/Security
export const securityConfig = {
  helmetEnabled: config.HELMET_ENABLED,
};

// Configurações de áudio
export const audioConfig = {
  sampleRate: config.AUDIO_SAMPLE_RATE,
  vadSilenceThreshold: config.VAD_SILENCE_THRESHOLD_MS,
  maxDuration: config.MAX_AUDIO_DURATION_MS,
  enableDebug: config.DEBUG_AUDIO,
};

// Configurações de AI
// Configurações de AI (Removidas - movidas para AI Service)
export const aiConfig = {
  mocks: {
    asr: config.MOCK_ASR,
    llm: config.MOCK_LLM,
  },
};

// Configurações de compliance
export const complianceConfig = {
  enableRecording: config.ENABLE_RECORDING,
  dataRetentionDays: config.DATA_RETENTION_DAYS,
  hipaaMode: config.HIPAA_COMPLIANT_MODE,
};

export default config;