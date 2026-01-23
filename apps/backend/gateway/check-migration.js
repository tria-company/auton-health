const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../frontend/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('🔍 Verificando configuração...');
if (!supabaseUrl || !supabaseKey) {
  console.log('❌ Variáveis de ambiente não configuradas');
  console.log('URL:', supabaseUrl ? 'OK' : 'FALTANDO');
  console.log('KEY:', supabaseKey ? 'OK' : 'FALTANDO');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  try {
    console.log('🚀 Iniciando migração...');
    
    // Primeiro, verificar se a tabela call_sessions existe
    const { data: tables, error: tablesError } = await supabase
      .from('call_sessions')
      .select('id')
      .limit(1);
    
    if (tablesError) {
      console.log('❌ Tabela call_sessions não existe');
      console.log('📋 Execute este SQL no painel do Supabase:');
      console.log('');
      console.log(`CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  consultation_id UUID,
  session_type VARCHAR(20) DEFAULT 'online' CHECK (session_type IN ('presencial', 'online')),
  participants JSONB NOT NULL DEFAULT '{}'::jsonb,
  room_name VARCHAR(255),
  room_id VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'ended', 'error')),
  consent BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_session_type ON call_sessions(session_type);
CREATE INDEX IF NOT EXISTS idx_call_sessions_consultation_id ON call_sessions(consultation_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);`);
      console.log('');
      
    } else {
      console.log('✅ Tabela call_sessions existe');
      
      // Tentar inserir registro de teste para verificar se session_type existe
      const testData = {
        session_type: 'presencial',
        participants: { doctor: { id: 'test' }, patient: { id: 'test' } },
        consent: true
      };
      
      const { data, error } = await supabase
        .from('call_sessions')
        .insert([testData])
        .select();
      
      if (error) {
        if (error.message.includes('session_type')) {
          console.log('❌ Coluna session_type não existe');
          console.log('📋 Execute este SQL no painel do Supabase:');
          console.log('');
          console.log(`ALTER TABLE call_sessions 
ADD COLUMN session_type VARCHAR(20) DEFAULT 'online' 
CHECK (session_type IN ('presencial', 'online'));

CREATE INDEX IF NOT EXISTS idx_call_sessions_session_type ON call_sessions(session_type);`);
          console.log('');
        } else {
          console.log('❌ Outro erro:', error.message);
          console.log('Código do erro:', error.code);
        }
      } else {
        console.log('✅ Coluna session_type existe e funciona!');
        // Limpar registro teste
        if (data && data[0]) {
          await supabase.from('call_sessions').delete().eq('id', data[0].id);
          console.log('🧹 Registro teste removido');
        }
      }
    }
    
  } catch (err) {
    console.log('❌ Erro geral:', err.message);
  }
}

runMigration();
