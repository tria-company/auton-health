-- =====================================================
-- MIGRAÇÃO: Adicionar coluna exames e configurar Storage
-- =====================================================

-- 1. Adicionar coluna exames (array de URLs) na tabela consultations
ALTER TABLE consultations ADD COLUMN IF NOT EXISTS exames TEXT[] DEFAULT '{}';

COMMENT ON COLUMN consultations.exames IS 'Array de URLs de exames armazenados no Supabase Storage (bucket: documents)';

-- 2. Criar bucket de Storage para documentos/exames
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de Storage (RLS) para o bucket documents

-- Permitir upload para usuários autenticados
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Permitir leitura pública (URLs públicas)
CREATE POLICY "Public read access for documents"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'documents');

-- Permitir delete para usuários autenticados (donos)
CREATE POLICY "Authenticated users can delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
