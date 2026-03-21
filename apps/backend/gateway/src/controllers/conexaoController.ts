import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { config } from '../config';

const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
);

const evoBaseUrl = config.EVO_SERVICE_URL.replace(/\/$/, '');
const evoApiKey = config.EVO_APIKEY;

/**
 * Monta a URL base do gateway para o webhook da Evolution.
 * A Evolution vai chamar: POST {gatewayUrl}/conexao/webhook
 */
function getWebhookUrl(): string {
  const frontendUrl = config.FRONTEND_URL || '';
  // Derivar gateway URL a partir da FRONTEND_URL ou usar variável específica
  const gatewayUrl = process.env.GATEWAY_PUBLIC_URL
    || process.env.NEXT_PUBLIC_GATEWAY_URL
    || (frontendUrl ? frontendUrl.replace(':3000', ':8080') : 'http://localhost:8080');
  return `${gatewayUrl.replace(/\/$/, '')}/conexao/webhook`;
}

/**
 * Gera o nome da instância a partir do nome do médico.
 */
function generateInstanceName(doctorName: string): string {
  return doctorName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .toLowerCase();
}

/**
 * Busca o médico logado a partir do user_auth
 */
async function getMedico(userAuthId: string) {
  const { data, error } = await supabase
    .from('medicos')
    .select('id, name')
    .eq('user_auth', userAuthId)
    .single();

  if (error || !data) return null;
  return data;
}

/**
 * Mapeia o estado da Evolution para nosso status
 */
function mapEvoState(evoState: string): string {
  if (evoState === 'open') return 'connected';
  if (evoState === 'connecting') return 'connecting';
  return 'disconnected';
}

/**
 * GET /conexao/status
 */
export async function getConexaoStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Não autenticado' });

    const medico = await getMedico(userId);
    if (!medico) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { data: conexao } = await supabase
      .from('conexoes_whatsapp')
      .select('*')
      .eq('doctor_id', medico.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conexao) {
      return res.json({ success: true, status: 'disconnected', conexao: null });
    }

    // Verificar status real na Evolution se não está desconectado
    if (conexao.instancia_nome && conexao.instancia_status !== 'disconnected') {
      try {
        const evoResponse = await fetch(`${evoBaseUrl}/instance/connectionState/${conexao.instancia_nome}`, {
          method: 'GET',
          headers: { 'apikey': evoApiKey },
        });

        if (evoResponse.ok) {
          const evoData = await evoResponse.json() as any;
          const evoState = evoData?.instance?.state || evoData?.state || 'close';
          const mappedStatus = mapEvoState(evoState);

          if (mappedStatus !== conexao.instancia_status) {
            await supabase
              .from('conexoes_whatsapp')
              .update({ instancia_status: mappedStatus })
              .eq('id', conexao.id);
            conexao.instancia_status = mappedStatus;
          }
        }
      } catch (evoError) {
        console.error('⚠️ [CONEXAO] Erro ao verificar estado na Evolution:', evoError);
      }
    }

    return res.json({ success: true, status: conexao.instancia_status || 'disconnected', conexao });
  } catch (error) {
    console.error('❌ [CONEXAO] Erro ao buscar status:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /conexao/connect
 */
export async function createInstance(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Não autenticado' });

    const medico = await getMedico(userId);
    if (!medico) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const instanceName = generateInstanceName(medico.name);
    const webhookUrl = getWebhookUrl();
    console.log(`📱 [CONEXAO] Criando instância "${instanceName}" para médico ${medico.id}`);
    console.log(`🔗 [CONEXAO] Webhook URL: ${webhookUrl}`);

    // Criar instância com webhook configurado
    const createResponse = await fetch(`${evoBaseUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evoApiKey,
      },
      body: JSON.stringify({
        instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
        webhook: {
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: [
            'CONNECTION_UPDATE',
          ],
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('❌ [CONEXAO] Erro ao criar instância:', createResponse.status, errorText);

      if (createResponse.status === 403 || errorText.includes('already')) {
        console.log('🔄 [CONEXAO] Instância já existe, tentando conectar...');
        return await connectExistingInstance(res, medico, instanceName, webhookUrl);
      }

      return res.status(500).json({ success: false, error: 'Erro ao criar instância na Evolution API' });
    }

    const createData = await createResponse.json() as any;
    console.log('✅ [CONEXAO] Instância criada:', instanceName);

    const qrCodeBase64 = createData?.qrcode?.base64 || null;

    // Salvar/atualizar no banco
    const { data: existingConexao } = await supabase
      .from('conexoes_whatsapp')
      .select('id')
      .eq('doctor_id', medico.id)
      .maybeSingle();

    if (existingConexao) {
      await supabase
        .from('conexoes_whatsapp')
        .update({
          instancia_nome: instanceName,
          instancia_status: 'connecting',
          instancia_qrcode: qrCodeBase64,
        })
        .eq('id', existingConexao.id);
    } else {
      await supabase
        .from('conexoes_whatsapp')
        .insert({
          doctor_id: medico.id,
          instancia_nome: instanceName,
          instancia_status: 'connecting',
          instancia_qrcode: qrCodeBase64,
        });
    }

    return res.json({
      success: true,
      instanceName,
      qrcode: qrCodeBase64,
      status: 'connecting',
    });
  } catch (error) {
    console.error('❌ [CONEXAO] Erro ao criar instância:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * Conecta instância existente e atualiza webhook
 */
async function connectExistingInstance(res: Response, medico: { id: string; name: string }, instanceName: string, webhookUrl: string) {
  try {
    // Atualizar webhook da instância existente
    try {
      await fetch(`${evoBaseUrl}/webhook/set/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evoApiKey,
        },
        body: JSON.stringify({
          url: webhookUrl,
          byEvents: false,
          base64: false,
          events: ['CONNECTION_UPDATE'],
        }),
      });
      console.log(`🔗 [CONEXAO] Webhook atualizado para instância existente "${instanceName}"`);
    } catch (whErr) {
      console.warn('⚠️ [CONEXAO] Erro ao atualizar webhook (continuando):', whErr);
    }

    const connectResponse = await fetch(`${evoBaseUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: { 'apikey': evoApiKey },
    });

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text();
      console.error('❌ [CONEXAO] Erro ao conectar instância existente:', errorText);
      return res.status(500).json({ success: false, error: 'Erro ao conectar instância' });
    }

    const connectData = await connectResponse.json() as any;
    const qrCodeBase64 = connectData?.base64 || null;

    const { data: existingConexao } = await supabase
      .from('conexoes_whatsapp')
      .select('id')
      .eq('doctor_id', medico.id)
      .maybeSingle();

    if (existingConexao) {
      await supabase
        .from('conexoes_whatsapp')
        .update({
          instancia_nome: instanceName,
          instancia_status: 'connecting',
          instancia_qrcode: qrCodeBase64,
        })
        .eq('id', existingConexao.id);
    } else {
      await supabase
        .from('conexoes_whatsapp')
        .insert({
          doctor_id: medico.id,
          instancia_nome: instanceName,
          instancia_status: 'connecting',
          instancia_qrcode: qrCodeBase64,
        });
    }

    return res.json({
      success: true,
      instanceName,
      qrcode: qrCodeBase64,
      status: 'connecting',
    });
  } catch (error) {
    console.error('❌ [CONEXAO] Erro ao conectar instância existente:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}

/**
 * POST /conexao/webhook
 * Webhook chamado pela Evolution API quando o status da conexão muda.
 * Não requer autenticação (chamado pela Evolution).
 *
 * Payload da Evolution (CONNECTION_UPDATE):
 * {
 *   "event": "connection.update",
 *   "instance": "nome_da_instancia",
 *   "data": { "state": "open" | "close" | "connecting" },
 *   ...
 * }
 */
export async function handleEvolutionWebhook(req: Request, res: Response) {
  try {
    const body = req.body;
    const event = body?.event;
    const instanceName = body?.instance;
    const state = body?.data?.state || body?.state;

    console.log(`🔔 [WEBHOOK] Recebido evento "${event}" da instância "${instanceName}" - state: "${state}"`);

    // Só processar eventos de connection.update
    if (!instanceName) {
      return res.status(200).json({ received: true });
    }

    // Aceitar tanto "connection.update" quanto outros formatos
    if (event && !event.includes('connection')) {
      return res.status(200).json({ received: true });
    }

    if (!state) {
      console.log('⚠️ [WEBHOOK] Evento sem state, ignorando');
      return res.status(200).json({ received: true });
    }

    const mappedStatus = mapEvoState(state);

    console.log(`📱 [WEBHOOK] Instância "${instanceName}" mudou para: ${state} → ${mappedStatus}`);

    // Atualizar no banco
    const { data: conexao, error } = await supabase
      .from('conexoes_whatsapp')
      .update({
        instancia_status: mappedStatus,
        // Limpar QR code quando conectar
        ...(mappedStatus === 'connected' ? { instancia_qrcode: null } : {}),
      })
      .eq('instancia_nome', instanceName)
      .select('id, doctor_id')
      .maybeSingle();

    if (error) {
      console.error('❌ [WEBHOOK] Erro ao atualizar banco:', error);
    } else if (conexao) {
      console.log(`✅ [WEBHOOK] Status atualizado para "${mappedStatus}" (doctor: ${conexao.doctor_id})`);
    } else {
      console.warn(`⚠️ [WEBHOOK] Instância "${instanceName}" não encontrada no banco`);
    }

    return res.status(200).json({ received: true, status: mappedStatus });
  } catch (error) {
    console.error('❌ [WEBHOOK] Erro no webhook:', error);
    // Sempre retornar 200 para a Evolution não ficar reenviando
    return res.status(200).json({ received: true, error: 'internal' });
  }
}

/**
 * POST /conexao/disconnect
 */
export async function disconnectInstance(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'Não autenticado' });

    const medico = await getMedico(userId);
    if (!medico) return res.status(404).json({ success: false, error: 'Médico não encontrado' });

    const { data: conexao } = await supabase
      .from('conexoes_whatsapp')
      .select('*')
      .eq('doctor_id', medico.id)
      .maybeSingle();

    if (!conexao || !conexao.instancia_nome) {
      return res.json({ success: true, status: 'disconnected' });
    }

    console.log(`📱 [CONEXAO] Desconectando instância "${conexao.instancia_nome}"...`);

    try {
      await fetch(`${evoBaseUrl}/instance/logout/${conexao.instancia_nome}`, {
        method: 'DELETE',
        headers: { 'apikey': evoApiKey },
      });
    } catch (evoError) {
      console.warn('⚠️ [CONEXAO] Erro ao fazer logout na Evolution (continuando):', evoError);
    }

    try {
      await fetch(`${evoBaseUrl}/instance/delete/${conexao.instancia_nome}`, {
        method: 'DELETE',
        headers: { 'apikey': evoApiKey },
      });
    } catch (evoError) {
      console.warn('⚠️ [CONEXAO] Erro ao deletar instância na Evolution (continuando):', evoError);
    }

    await supabase
      .from('conexoes_whatsapp')
      .update({
        instancia_status: 'disconnected',
        instancia_qrcode: null,
      })
      .eq('id', conexao.id);

    console.log('✅ [CONEXAO] Instância desconectada');
    return res.json({ success: true, status: 'disconnected' });
  } catch (error) {
    console.error('❌ [CONEXAO] Erro ao desconectar:', error);
    return res.status(500).json({ success: false, error: 'Erro interno' });
  }
}
