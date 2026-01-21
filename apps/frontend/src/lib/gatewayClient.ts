/**
 * Gateway HTTP Client
 * 
 * Client-side HTTP helper para comunicação com o Gateway backend.
 * Injeta automaticamente o token de autenticação do Supabase.
 */

import { createBrowserClient } from '@supabase/ssr';

// Singleton do Supabase client para uso interno
let supabaseClient: ReturnType<typeof createBrowserClient> | null = null;

function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[gatewayClient] Supabase env vars não configuradas');
      throw new Error('Supabase não configurado');
    }

    supabaseClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}

/**
 * Obtém o token de autenticação da sessão atual
 */
async function getAuthToken(): Promise<string | null> {
  try {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error('[gatewayClient] Erro ao obter token:', error);
    return null;
  }
}

/**
 * Configuração base do Gateway
 */
const GATEWAY_BASE_URL = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || '';

if (!GATEWAY_BASE_URL && typeof window !== 'undefined') {
  console.warn('[gatewayClient] NEXT_PUBLIC_GATEWAY_HTTP_URL não configurada');
}

/**
 * Interface para opções de requisição
 */
interface RequestOptions {
  headers?: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string | number | boolean>;
}

/**
 * Interface para resposta do Gateway
 */
interface GatewayResponse<T = any> {
  data?: T;
  error?: string;
  success?: boolean;
  [key: string]: any;
}

/**
 * Monta a URL completa com query params
 */
function buildUrl(endpoint: string, queryParams?: Record<string, string | number | boolean>): string {
  // Validar se GATEWAY_BASE_URL está configurada
  if (!GATEWAY_BASE_URL) {
    throw new Error('NEXT_PUBLIC_GATEWAY_HTTP_URL não configurada');
  }

  const url = new URL(endpoint.startsWith('/') ? endpoint : `/${endpoint}`, GATEWAY_BASE_URL);
  
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });
  }

  return url.toString();
}

/**
 * Executa uma requisição HTTP ao Gateway
 */
async function request<T = any>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  options: RequestOptions = {}
): Promise<GatewayResponse<T>> {
  try {
    const token = await getAuthToken();
    
    // buildUrl pode lançar erro se GATEWAY_BASE_URL não estiver configurada
    const url = buildUrl(endpoint, options.queryParams);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // Adiciona Authorization header se houver token
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // Adiciona body apenas para métodos que suportam
    if (method !== 'GET' && options.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);

    // Tenta parsear JSON
    let data: any;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      data = { message: text };
    }

    // Se a resposta não for ok, lança erro
    if (!response.ok) {
      console.error(`[gatewayClient] Erro ${method} ${endpoint}:`, {
        status: response.status,
        statusText: response.statusText,
        data,
      });

      return {
        error: data?.error || data?.message || `Erro ${response.status}: ${response.statusText}`,
        success: false,
        ...data,
      };
    }

    return {
      success: true,
      ...data,
    };
  } catch (error) {
    // Captura erros de buildUrl (URL não configurada) e erros de rede
    console.error(`[gatewayClient] Exceção em ${method} ${endpoint}:`, error);
    return {
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false,
    };
  }
}

/**
 * Gateway Client - Métodos públicos
 */
export const gatewayClient = {
  /**
   * GET request
   * @example gatewayClient.get('/health', { queryParams: { check: 'db' } })
   */
  get: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('GET', endpoint, options),

  /**
   * POST request
   * @example gatewayClient.post('/ai/edit', { body: { text: 'hello' } })
   */
  post: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('POST', endpoint, { ...options, body }),

  /**
   * PUT request
   * @example gatewayClient.put('/consultations/123', { body: { status: 'completed' } })
   */
  put: <T = any>(endpoint: string, body?: any, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('PUT', endpoint, { ...options, body }),

  /**
   * DELETE request
   * @example gatewayClient.delete('/consultations/123')
   */
  delete: <T = any>(endpoint: string, options?: Omit<RequestOptions, 'body'>) =>
    request<T>('DELETE', endpoint, options),
};

/**
 * Helpers adicionais
 */
export const gatewayHelpers = {
  /**
   * Verifica se o Gateway está configurado
   */
  isConfigured: () => Boolean(GATEWAY_BASE_URL),

  /**
   * Retorna a URL base do Gateway
   */
  getBaseUrl: () => GATEWAY_BASE_URL,

  /**
   * Verifica saúde do Gateway
   */
  healthCheck: async () => {
    return gatewayClient.get('/health');
  },
};

// Export default para conveniência
export default gatewayClient;
