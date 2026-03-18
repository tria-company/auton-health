import { createBrowserClient } from '@supabase/ssr';

// Configuração do Supabase usando variáveis NEXT_PUBLIC_ para client-side
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Debug: log once on the client to verify env injection
if (typeof window !== 'undefined') {
  // Only log masked values to avoid exposing secrets in full
  const maskedKey = (supabaseAnonKey || '').slice(0, 6) + '...' + (supabaseAnonKey || '').slice(-4);
  // eslint-disable-next-line no-console
  console.log('[DEBUG] supabase.ts env', {
    url: supabaseUrl,
    anonKey: maskedKey,
    hasUrl: Boolean(supabaseUrl),
    hasAnonKey: Boolean(supabaseAnonKey),
    allEnvKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
  });
}

// Função para verificar se as variáveis estão configuradas
function getSupabaseConfigStatus() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url !== 'https://placeholder.supabase.co' && key !== 'placeholder-key');
}

// Verificar se as variáveis estão configuradas
const isSupabaseConfigured = getSupabaseConfigStatus();


// Aguardar que as variáveis sejam carregadas antes de criar o cliente
if (!supabaseUrl || !supabaseAnonKey) {
}

// Função para aguardar carregamento das variáveis de ambiente
export function waitForSupabaseConfig(): Promise<boolean> {
  return new Promise((resolve) => {
    if (isSupabaseConfigured) {
      resolve(true);
      return;
    }

    // Aguardar um pouco para as variáveis carregarem
    setTimeout(() => {
      const newCheck = Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      resolve(newCheck);
    }, 100);
  });
}

// Cliente Supabase para browser com configuração SSR correta
export const supabase = createBrowserClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Export for debugging in other modules
export const supabaseConfigDebug = {
  url: supabaseUrl || 'undefined',
  hasAnonKey: Boolean(supabaseAnonKey),
};

// Validação crítica - se não temos as envs, não devemos usar o cliente
if (typeof window !== 'undefined' && (!supabaseUrl || !supabaseAnonKey)) {
  // eslint-disable-next-line no-console
  console.error('[DEBUG] CRITICAL: Supabase envs missing!', {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey ? 'present' : 'missing',
    willUsePlaceholder: true,
  });
}

// Função para verificar se o usuário está autenticado
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return !!session;
  } catch (error) {
    return false;
  }
}

// Função para obter o usuário atual
export async function getCurrentUser() {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    return null;
  }
}

// Função para verificar estado da sessão no client-side
export async function getClientSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();


    return { session, error };
  } catch (error) {
    return { session: null, error };
  }
}

// Função para buscar pacientes do médico logado
export async function getPatients() {
  // Verificar configuração dinamicamente
  const isConfigured = getSupabaseConfigStatus();

  // Se o Supabase não estiver configurado, retornar pacientes mock
  if (!isConfigured) {
    console.warn('⚠️ Supabase não configurado, usando dados mock');
    return [
      { id: '1', name: 'MOC - João Silva', email: 'joao@email.com', phone: '(11) 99999-9999', city: 'São Paulo', status: 'active' },
      { id: '2', name: 'MOC - Maria Santos', email: 'maria@email.com', phone: '(11) 88888-8888', city: 'Rio de Janeiro', status: 'active' },
      { id: '3', name: 'MOC - Pedro Oliveira', email: 'pedro@email.com', phone: '(11) 77777-7777', city: 'Belo Horizonte', status: 'active' },
    ];
  }

  try {
    // ✅ CORREÇÃO: Usar a mesma lógica da API /api/patients
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.user) {
      console.error('❌ Usuário não autenticado');
      return [];
    }

    console.log('🔍 Buscando pacientes para médico:', session.user.id);

    // ✅ Buscar médico na tabela medicos usando a FK do auth.users
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', session.user.id)
      .single();

    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      return [];
    }

    console.log('✅ Médico encontrado:', medico.id);

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .eq('doctor_id', medico.id) // ✅ Usar medicos.id, não auth.users.id
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Erro ao buscar pacientes:', error);
      return [];
    }

    console.log('✅ Pacientes encontrados:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('💥 Erro na conexão com Supabase:', error);
    return [];
  }
}

// Buscar nome do paciente por ID (para auto-join do paciente)
export async function getPatientNameById(patientId: string): Promise<string | null> {
  try {
    const isConfigured = getSupabaseConfigStatus();
    if (!isConfigured) {
      console.warn('⚠️ Supabase não configurado, retornando nome mock para paciente');
      return 'Paciente';
    }

    const { data, error } = await supabase
      .from('patients')
      .select('name')
      .eq('id', patientId)
      .single();

    if (error) {
      console.error('❌ Erro ao buscar paciente por ID:', error);
      return null;
    }

    return data?.name || null;
  } catch (err) {
    console.error('💥 Erro inesperado ao buscar paciente por ID:', err);
    return null;
  }
}

// Função para criar nova consulta
export async function createConsultation(consultationData: {
  patient_id: string;
  consultation_type: 'PRESENCIAL' | 'TELEMEDICINA';
  patient_name: string;
}) {
  try {
    console.log('📝 Criando consulta via Supabase...', consultationData);

    // Buscar usuário autenticado
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('❌ Usuário não autenticado');
      throw new Error('Usuário não autenticado');
    }

    // Buscar médico na tabela medicos usando a FK do auth.users
    const { data: medico, error: medicoError } = await supabase
      .from('medicos')
      .select('id')
      .eq('user_auth', user.id)
      .single();

    if (medicoError || !medico) {
      console.error('❌ Médico não encontrado:', medicoError);
      throw new Error('Médico não encontrado. Verifique se sua conta está sincronizada.');
    }

    // ✅ Determinar "from" baseado na URL de origem
    let consultationFrom: string | null = null;
    const origin = window.location.origin;
    if (origin.includes('medcall-ai-frontend-v2.vercel.app')) {
      consultationFrom = 'medcall';
    } else if (origin.includes('autonhealth.com.br')) {
      consultationFrom = 'auton';
    } else if (origin.includes('localhost')) {
      consultationFrom = 'localhost';
    }

    // Criar consulta no Supabase
    const { data: consultation, error: insertError } = await supabase
      .from('consultations')
      .insert({
        ...consultationData,
        doctor_id: medico.id,
        from: consultationFrom,
        consulta_inicio: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !consultation) {
      console.error('❌ Erro ao criar consulta:', insertError);
      throw new Error(insertError?.message || 'Erro ao criar consulta');
    }

    console.log('✅ Consulta criada com sucesso:', consultation.id);
    return consultation;

  } catch (error) {
    console.error('💥 Erro na criação da consulta:', error);
    throw error;
  }
}
