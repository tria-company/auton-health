/**
 * Configuração dinâmica de webhooks baseada no ambiente
 */

export interface WebhookConfig {
  baseUrl: string;
  authHeader: string;
}

export interface WebhookEndpoints {
  anamnese: string;
  edicaoAnamnese: string;
  transcricao: string;
  edicaoDiagnostico: string;
  diagnosticoPrincipal: string;
  edicaoSolucao: string;
  edicaoLivroDaVida: string;
  triggerSolucao: string;
  solucaoCriacaoEntregaveis: string;
  exames: string;
}

/**
 * Retorna a configuração de webhook baseada no ambiente
 */
export function getWebhookConfig(): WebhookConfig {
  // Usar NEXT_PUBLIC_NODE_ENV para client-side, fallback para NODE_ENV no server-side
  const nodeEnv = process.env.NEXT_PUBLIC_NODE_ENV || process.env.NODE_ENV;
  const isDevelopment = nodeEnv === 'development';

  return {
    baseUrl: 'https://triahook.gst.dev.br',
    //baseUrl: 'https://webhook.tc1.triacompany.com.br',
    authHeader: 'Vc1mgGDEcnyqLH3LoHGUXoLTUg2BRVSu'
  };
}

/**
 * Retorna os endpoints de webhook baseados no ambiente
 */
export function getWebhookEndpoints(): WebhookEndpoints {
  const config = getWebhookConfig();
  // Usar NEXT_PUBLIC_NODE_ENV para client-side, fallback para NODE_ENV no server-side
  const nodeEnv = process.env.NEXT_PUBLIC_NODE_ENV || process.env.NODE_ENV;
  const isDevelopment = nodeEnv === 'development';

  const suffix = isDevelopment ? '-teste' : '';

  console.log('🔗🔗 Webhook endpoints configurados:', {
    baseUrl: config.baseUrl,
    suffix,
    isDevelopment,
    nodeEnv
  });

  return {
    anamnese: `${config.baseUrl}/webhook/usi-anamnese-preenchimento-v2`,
    edicaoAnamnese: `${config.baseUrl}/webhook/usi-input-edicao-analise-v2`,
    transcricao: `${config.baseUrl}/webhook/usi-analise-v2`,
    edicaoDiagnostico: `${config.baseUrl}/webhook/usi-input-edicao-diagnostico-v2`,
    diagnosticoPrincipal: `${config.baseUrl}/webhook/diagnostico-principal-v2`,
    edicaoSolucao: `${config.baseUrl}/webhook/usi-input-edicao-solucao-v2`,
    edicaoLivroDaVida: `${config.baseUrl}/webhook/usi-solucao-livro-vida-v2`,
    triggerSolucao: `${config.baseUrl}/webhook/usi-trigger-solucao${suffix}`,
    solucaoCriacaoEntregaveis: `${config.baseUrl}/webhook/usi-solucao-criacao-entregaveis${suffix}`,
    exames: `${config.baseUrl}/webhook/5d03fec8-6a3a-4399-8ddc-a4839e0db3ea/:input-at-exames-usi-v2`
  };
}

/**
 * Retorna os headers padrão para requisições de webhook
 */
export function getWebhookHeaders(): Record<string, string> {
  const config = getWebhookConfig();

  return {
    'Content-Type': 'application/json',
    'Authorization': config.authHeader
  };
}

