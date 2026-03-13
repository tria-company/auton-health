import { Request, Response } from 'express';
import { Resend } from 'resend';
import { AuthenticatedRequest } from '../middleware/auth';

// Lazy initialization do Resend para evitar problemas na inicialização
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

/**
 * POST /email/anamnese
 * Envia email de anamnese inicial para paciente
 */
export async function sendAnamneseEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { to, patientName, anamneseLink } = req.body;

    // Validação
    if (!to || !patientName || !anamneseLink) {
      res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: to, patientName, anamneseLink'
      });
      return;
    }

    // Verificar se RESEND_API_KEY está configurado
    if (!process.env.RESEND_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'RESEND_API_KEY não configurado no servidor'
      });
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const appName = process.env.APP_NAME || 'Auton Health';

    // Verificar se está em modo de teste
    const isTestMode = fromEmail.includes('@resend.dev');

    if (isTestMode) {
      const verifiedEmail = process.env.RESEND_VERIFIED_EMAIL || 'ferramentas@triacompany.com.br';
      if (to !== verifiedEmail) {
        res.status(400).json({
          success: false,
          error: `Resend em modo de teste. Só é possível enviar para ${verifiedEmail}`
        });
        return;
      }
    }

    console.log('📧 [EMAIL] Enviando email de anamnese inicial via Resend...');
    console.log('  - Para:', to);
    console.log('  - Link:', anamneseLink);

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [to],
      subject: `Preencha sua Anamnese Inicial - ${appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Anamnese Inicial</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1B4266 0%, #153350 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Anamnese Inicial</h1>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Olá <strong>${patientName}</strong>,
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Seu médico solicitou que você preencha sua <strong>Anamnese Inicial</strong>. Esta é uma etapa importante para que possamos realizar uma avaliação completa e personalizada.
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Clique no botão abaixo para acessar o formulário:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a 
                href="${anamneseLink}" 
                style="display: inline-block; background: linear-gradient(135deg, #1B4266 0%, #153350 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(27, 66, 102, 0.3);">
                Preencher Anamnese Inicial
              </a>
            </div>
            
            <div style="background: #f9fafb; border-left: 4px solid #1B4266; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <strong>⏱️ Tempo estimado:</strong> 10-15 minutos<br>
                <strong>📋 Informações necessárias:</strong> Dados pessoais, histórico de saúde, preferências alimentares e atividades físicas
              </p>
            </div>
            
            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Se você não solicitou este formulário ou tiver alguma dúvida, entre em contato com seu médico.
            </p>
            
            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar email:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enviar email'
      });
      return;
    }

    console.log('✅ [EMAIL] Email enviado com sucesso:', data?.id);

    res.json({
      success: true,
      emailId: data?.id,
      message: 'Email enviado com sucesso'
    });
  } catch (error) {
    console.error('❌ [EMAIL] Erro inesperado:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar email'
    });
  }
}

/**
 * POST /email/patient-credentials
 * Envia email com link de acesso (sem senha em texto plano) para paciente
 */
export async function sendPatientCredentialsEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { to, patientName, email: userEmail, accessLink } = req.body;

    // Validação
    if (!to || !patientName || !userEmail || !accessLink) {
      res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: to, patientName, email, accessLink'
      });
      return;
    }

    // Verificar se RESEND_API_KEY está configurado
    if (!process.env.RESEND_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'RESEND_API_KEY não configurado no servidor'
      });
      return;
    }

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const appName = process.env.APP_NAME || 'Auton Health';

    // Verificar se está em modo de teste
    const isTestMode = fromEmail.includes('@resend.dev');

    if (isTestMode) {
      const verifiedEmail = process.env.RESEND_VERIFIED_EMAIL || 'ferramentas@triacompany.com.br';
      if (to !== verifiedEmail) {
        res.status(400).json({
          success: false,
          error: `Resend em modo de teste. Só é possível enviar para ${verifiedEmail}`
        });
        return;
      }
    }

    console.log('📧 [EMAIL] Enviando email com link de acesso via Resend...');
    console.log('  - Para:', to);
    console.log('  - Email do usuário:', userEmail);

    const resend = getResend();
    const { data, error } = await resend.emails.send({
      from: `${appName} <${fromEmail}>`,
      to: [to],
      subject: `Defina sua senha de acesso - ${appName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Acesso ao Sistema</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1B4266 0%, #153350 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Acesso ao Sistema</h1>
          </div>

          <div style="background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <p style="font-size: 16px; margin-bottom: 20px;">
              Olá <strong>${patientName}</strong>,
            </p>

            <p style="font-size: 16px; margin-bottom: 20px;">
              Sua conta de acesso ao sistema foi criada com sucesso!
              Clique no botão abaixo para definir sua senha e acessar o sistema.
            </p>

            <div style="background: #f9fafb; border: 2px solid #1B4266; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <div style="margin-bottom: 10px;">
                <strong style="color: #6b7280; font-size: 14px; display: block; margin-bottom: 5px;">Seu e-mail de acesso:</strong>
                <div style="background: white; padding: 12px; border-radius: 6px; border: 1px solid #d1d5db; font-family: monospace; font-size: 16px; color: #1B4266; font-weight: 600;">
                  ${userEmail}
                </div>
              </div>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <a
                href="${accessLink}"
                style="display: inline-block; background: linear-gradient(135deg, #1B4266 0%, #153350 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(27, 66, 102, 0.3);">
                Definir Senha e Acessar
              </a>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #92400e;">
                <strong>⏱️ Importante:</strong> Este link é válido por tempo limitado. Se expirar, solicite um novo link ao seu médico.
              </p>
            </div>

            <div style="background: #f9fafb; border-left: 4px solid #1B4266; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; font-size: 14px; color: #6b7280;">
                <strong>🔒 Dicas de Segurança:</strong><br>
                • Escolha uma senha forte e única<br>
                • Não compartilhe sua senha com ninguém<br>
                • Nunca clique em links suspeitos
              </p>
            </div>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 20px;">
              Se você não solicitou esta conta ou tiver alguma dúvida, entre em contato com seu médico ou suporte.
            </p>

            <p style="font-size: 12px; color: #9ca3af; margin-top: 20px; text-align: center;">
              Este é um email automático, por favor não responda.
            </p>
          </div>
        </body>
        </html>
      `
    });

    if (error) {
      console.error('❌ [EMAIL] Erro ao enviar email:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Erro ao enviar email'
      });
      return;
    }

    console.log('✅ [EMAIL] Email com link de acesso enviado com sucesso:', data?.id);

    res.json({
      success: true,
      emailId: data?.id,
      message: 'Email com link de acesso enviado com sucesso'
    });
  } catch (error) {
    console.error('❌ [EMAIL] Erro inesperado:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido ao enviar email'
    });
  }
}
