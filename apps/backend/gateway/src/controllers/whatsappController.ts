import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { whatsappService } from '../services/whatsapp.service';
import { createClient } from '@supabase/supabase-js';
import { config } from '../config';
import { z } from 'zod';

const supabase = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } }
);

const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || process.env.EVO_SERVICE_URL || 'https://evo.triacompany.com.br').trim().replace(/\/$/, '');
const EVOLUTION_API_KEY = (process.env.EVOLUTION_API_KEY || process.env.EVO_APIKEY || '').trim();

/**
 * Normaliza número de telefone para formato E.164 (apenas dígitos, Brasil 55 + DDD + número).
 */
function normalizePhoneToE164(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 12 && digits.startsWith('55')) return digits;
  if (digits.length === 11 || digits.length === 10) return '55' + digits;
  return digits;
}

/**
 * Busca o doctor_id do médico logado (user_auth → medicos.id)
 */
async function getDoctorId(userAuthId: string): Promise<string | undefined> {
  try {
    const { data } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', userAuthId)
      .single();
    return data?.id || undefined;
  } catch {
    return undefined;
  }
}

/**
 * POST /whatsapp/anamnese
 * Envia mensagem de anamnese inicial via Evolution API (WhatsApp) para o número do paciente.
 * Body: { phone, patientName, anamneseLink }
 */
export async function sendAnamneseWhatsApp(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { phone, patientName, anamneseLink } = req.body;

    if (!phone || !patientName || !anamneseLink) {
      res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: phone, patientName, anamneseLink'
      });
      return;
    }

    if (!EVOLUTION_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'EVOLUTION_API_KEY não configurado no servidor'
      });
      return;
    }

    const number = normalizePhoneToE164(phone);
    if (number.length < 12) {
      res.status(400).json({
        success: false,
        error: 'Número de telefone inválido. Use DDD + número (ex: 11999999999).'
      });
      return;
    }

    // Resolver instância do médico logado
    const doctorId = req.user?.id ? await getDoctorId(req.user.id) : undefined;
    const resolved = await whatsappService.resolveInstanceDetailed(doctorId);
    const instanceName = resolved.instanceName;

    // Verificar se o número possui WhatsApp
    const checkUrl = `${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`;
    try {
      const checkResponse = await fetch(checkUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': EVOLUTION_API_KEY
        },
        body: JSON.stringify({ numbers: [number] })
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json() as any[];
        if (checkData && checkData.length > 0 && !checkData[0].exists) {
          console.log('❌ [WHATSAPP] Número não possui WhatsApp:', number.slice(-4) + '****');
          res.status(400).json({
            success: false,
            error: 'O número informado não possui WhatsApp',
            code: 'WHATSAPP_NOT_FOUND'
          });
          return;
        }
        console.log('✅ [WHATSAPP] Número verificado - possui WhatsApp');
      }
    } catch (checkError) {
      console.warn('⚠️ [WHATSAPP] Erro ao verificar número, continuando envio:', checkError);
    }

    const text = `Olá *${patientName}*! 👋

Sua anamnese Chegou pela plataforma Auton Health.

📋 *O que é:* formulário com dados de saúde para uma avaliação mais personalizada.
⏱️ *Tempo estimado:* 10-15 minutos.

Acesse o link abaixo para preencher:
${anamneseLink}

Em caso de dúvidas, entre em contato com seu médico.
Esta é uma mensagem automática.`;

    const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
    console.log(`📱 [WHATSAPP] Enviando anamnese via "${instanceName}"...`, { number: number.slice(-4) + '****' });

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': EVOLUTION_API_KEY
      },
      body: JSON.stringify({
        number: number,
        text: text
      })
    });

    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

    if (!response.ok) {
      console.error('❌ [WHATSAPP] Erro Evolution API:', response.status, data);
      res.status(response.status >= 500 ? 502 : 400).json({
        success: false,
        error: data.message || data.error || `Evolution API retornou ${response.status}`
      });
      return;
    }

    console.log(`✅ [WHATSAPP] Mensagem enviada com sucesso via "${instanceName}"${resolved.isDefault ? ' (dispositivo padrão)' : ''}`);
    res.json({
      success: true,
      message: 'Mensagem enviada por WhatsApp com sucesso',
      usedDefaultDevice: resolved.isDefault,
    });
  } catch (error) {
    console.error('❌ [WHATSAPP] Erro inesperado:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro ao enviar mensagem WhatsApp'
    });
  }
}


/**
 * Envia link de acesso por WhatsApp via Evolution API.
 * Aceita doctorId opcional para usar a instância do médico.
 */
export async function sendAccessLinkWhatsApp(
  phone: string,
  patientName: string,
  userEmail: string,
  accessLink: string,
  doctorId?: string
): Promise<{ success: boolean; error?: string; code?: string; usedDefaultDevice?: boolean }> {
  const rawPhone = (phone || '').trim();
  if (!rawPhone) {
    console.log('📱 [WHATSAPP] Link de acesso: telefone vazio, não enviando');
    return { success: false, error: 'Telefone não informado' };
  }

  if (!EVOLUTION_API_KEY) {
    console.warn('⚠️ [WHATSAPP] EVOLUTION_API_KEY não configurado, ignorando envio');
    return { success: false, error: 'WhatsApp não configurado (EVOLUTION_API_KEY)' };
  }

  const number = normalizePhoneToE164(rawPhone);
  if (number.length < 12) {
    console.warn('⚠️ [WHATSAPP] Link de acesso: número inválido após normalização:', number.length, 'dígitos');
    return { success: false, error: 'Número de telefone inválido. Use DDD + número (ex: 11999999999)' };
  }

  // Resolver instância do médico (se tiver conectada, usa a dele)
  const resolved = await whatsappService.resolveInstanceDetailed(doctorId);
  const instanceName = resolved.instanceName;

  console.log(`📱 [WHATSAPP] Link de acesso: enviando via "${instanceName}"${resolved.isDefault ? ' (dispositivo padrão)' : ''} para número ${number.slice(0, 4)}****${number.slice(-4)}`);

  const appName = process.env.APP_NAME || 'Auton Health';

  const text = `Olá *${patientName}*! 👋

Sua conta de acesso ao *${appName}* foi criada.

📧 *E-mail:* ${userEmail}

🔗 Clique no link abaixo para definir sua senha e acessar o sistema:
${accessLink}

⏱️ Este link é válido por tempo limitado. Se expirar, solicite um novo ao seu médico.
Esta é uma mensagem automática.`;

  // Verificar se o número possui WhatsApp
  const checkUrl = `${EVOLUTION_API_URL}/chat/whatsappNumbers/${instanceName}`;
  try {
    const checkResponse = await fetch(checkUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ numbers: [number] })
    });
    if (checkResponse.ok) {
      const checkData = (await checkResponse.json()) as any[];
      if (checkData?.length > 0 && !checkData[0].exists) {
        console.log('❌ [WHATSAPP] Número não possui WhatsApp:', number.slice(-4) + '****');
        return { success: false, error: 'O número informado não possui WhatsApp', code: 'WHATSAPP_NOT_FOUND' };
      }
      console.log('✅ [WHATSAPP] Número verificado - possui WhatsApp');
    }
  } catch (checkError) {
    console.warn('⚠️ [WHATSAPP] Erro ao verificar número, continuando envio:', checkError);
  }

  const url = `${EVOLUTION_API_URL}/message/sendText/${instanceName}`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': EVOLUTION_API_KEY },
      body: JSON.stringify({ number, text })
    });
    const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

    if (!response.ok) {
      const errMsg = data?.message || data?.error || (typeof data === 'object' ? JSON.stringify(data) : String(data)) || `HTTP ${response.status}`;
      console.error('❌ [WHATSAPP] Erro Evolution API (link de acesso):', response.status, errMsg);
      return { success: false, error: errMsg };
    }
    console.log(`✅ [WHATSAPP] Link de acesso enviado por WhatsApp via "${instanceName}"${resolved.isDefault ? ' (dispositivo padrão)' : ''}`);
    return { success: true, usedDefaultDevice: resolved.isDefault };
  } catch (err: any) {
    console.error('❌ [WHATSAPP] Erro ao enviar link de acesso:', err);
    return { success: false, error: err?.message || 'Erro ao enviar WhatsApp' };
  }
}

// Schema de validação para envio de mensagem genérica
const sendTextSchema = z.object({
  number: z.string().min(1, 'Número é obrigatório'),
  text: z.string().min(1, 'Texto da mensagem é obrigatório'),
  doctorId: z.string().optional()
});

/**
 * POST /whatsapp/send
 * Envia uma mensagem de texto genérica via WhatsApp (Evolution API)
 */
export async function sendTextWhatsApp(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const { number, text, doctorId: bodyDoctorId } = sendTextSchema.parse(req.body);

    // Resolver doctor_id: do body ou do usuário logado
    let doctorId = bodyDoctorId;
    if (!doctorId && req.user?.id) {
      doctorId = await getDoctorId(req.user.id);
    }

    const whatsappCheck = await whatsappService.checkWhatsappNumber(number, doctorId);
    if (!whatsappCheck.exists) {
      return res.status(400).json({
        success: false,
        error: 'O número informado não possui WhatsApp',
        code: 'WHATSAPP_NOT_FOUND',
        number: whatsappCheck.number
      });
    }

    const result = await whatsappService.sendText({ number, text, doctorId });

    res.status(200).json({
      success: true,
      data: result,
      message: 'Mensagem enviada com sucesso',
      usedDefaultDevice: result?.usedDefaultDevice ?? false,
    });
  } catch (error) {
    next(error);
  }
}
