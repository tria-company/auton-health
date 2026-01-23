import Redis from 'ioredis';
import { redisConfig } from './providers';

// Cliente Redis (apenas se configurado)
export let redis: Redis | null = null;

// Inicializar Redis apenas se as credenciais estiverem disponíveis
export function initializeRedis(): Redis | null {
  if (!redisConfig) {
    console.log('Redis não configurado - executando sem cache');
    return null;
  }

  try {
    redis = new Redis(redisConfig);

    redis.on('connect', () => {
      console.log('Conectado ao Redis');
    });

    redis.on('error', (error) => {
      console.error('Erro no Redis:', error);
    });

    redis.on('close', () => {
      console.log('Conexão com Redis fechada');
    });

    return redis;
  } catch (error) {
    console.error('Falha ao inicializar Redis:', error);
    return null;
  }
}

// Helper functions para usar Redis de forma opcional
export const cache = {
  // Salvar dados no cache (se Redis estiver disponível)
  async set(key: string, value: any, ttlSeconds = 3600): Promise<boolean> {
    if (!redis) return false;

    try {
      const serialized = JSON.stringify(value);
      await redis.setex(key, ttlSeconds, serialized);
      return true;
    } catch (error) {
      console.error('Erro ao salvar no cache:', error);
      return false;
    }
  },

  // Buscar dados do cache
  async get<T = any>(key: string): Promise<T | null> {
    if (!redis) return null;

    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Erro ao buscar do cache:', error);
      return null;
    }
  },

  // Deletar do cache
  async del(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      await redis.del(key);
      return true;
    } catch (error) {
      console.error('Erro ao deletar do cache:', error);
      return false;
    }
  },

  // Verificar se uma chave existe
  async exists(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      const result = await redis.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Erro ao verificar existência no cache:', error);
      return false;
    }
  },

  // Incrementar contador
  async incr(key: string, ttlSeconds = 3600): Promise<number> {
    if (!redis) return 0;

    try {
      const result = await redis.incr(key);
      if (result === 1) {
        // Se é a primeira vez, definir TTL
        await redis.expire(key, ttlSeconds);
      }
      return result;
    } catch (error) {
      console.error('Erro ao incrementar contador:', error);
      return 0;
    }
  },
};

// Fechar conexão Redis
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}

export default redis;