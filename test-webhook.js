// Script para testar o webhook diretamente
const testWebhook = async () => {
  try {
    // Configuração baseada no ambiente
    const isDevelopment = process.env.NODE_ENV === 'development';
    const suffix = isDevelopment ? '-teste' : '';
    const authHeader = process.env.WEBHOOK_AUTH_HEADER || '';
    
    const webhookUrl = `https://webhook.tc1.triacompany.com.br/webhook/usi-input-edicao-diagnostico${suffix}`;
    
    const requestBody = {
      origem: 'IA',
      fieldPath: 'cadastro_prontuario.identificacao_nome_completo',
      texto: 'Teste de mensagem para o webhook',
      consultaId: '123456'
    };

    console.log('🚀 Testando webhook...');
    console.log('📤 Enviando:', requestBody);
    console.log('🔗 URL:', webhookUrl);
    console.log('🔐 Ambiente:', isDevelopment ? 'development' : 'production');

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(requestBody),
    });

    console.log('📊 Status:', response.status);
    console.log('✅ OK?', response.ok);

    if (!response.ok) {
      console.error('❌ Erro na resposta:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('📄 Conteúdo do erro:', errorText);
      return;
    }

    const data = await response.json();
    console.log('📥 Resposta recebida:');
    console.log('  Tipo:', typeof data);
    console.log('  É array?', Array.isArray(data));
    console.log('  Conteúdo:', JSON.stringify(data, null, 2));

    if (Array.isArray(data) && data.length > 0) {
      console.log('🔍 Primeiro item:', data[0]);
      console.log('🎯 Response field:', data[0]?.response);
    } else {
      console.log('⚠️ Resposta não é um array ou está vazia');
    }

  } catch (error) {
    console.error('💥 Erro na requisição:', error.message);
  }
};

testWebhook();