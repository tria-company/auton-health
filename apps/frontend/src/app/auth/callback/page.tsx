'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { LoadingScreen } from '@/components/shared/LoadingScreen';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Supabase troca o code por sessão automaticamente ao detectar os params na URL
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          // Aguardar um momento para o Supabase processar o callback
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();

          if (retryError || !retrySession?.user) {
            setError('Erro ao autenticar com Google. Tente novamente.');
            setTimeout(() => router.push('/auth/signup'), 3000);
            return;
          }

          await validateSubscription(retrySession.user.email);
          return;
        }

        await validateSubscription(session.user.email);
      } catch {
        setError('Erro inesperado. Tente novamente.');
        setTimeout(() => router.push('/auth/signup'), 3000);
      }
    };

    const validateSubscription = async (email: string | undefined) => {
      if (!email) {
        setError('Não foi possível obter o email da conta Google.');
        await supabase.auth.signOut();
        setTimeout(() => router.push('/auth/signup'), 3000);
        return;
      }

      // Verificar se o email existe na tabela assinaturas
      const { data: assinatura, error: assinaturaError } = await supabase
        .from('assinaturas')
        .select('id')
        .eq('email', email.toLowerCase().trim())
        .limit(1)
        .maybeSingle();

      if (assinaturaError) {
        console.error('[DEBUG] callback assinatura check error:', assinaturaError);
      }

      if (!assinatura) {
        // Email não tem assinatura - fazer logout e mostrar erro
        await supabase.auth.signOut();
        setError('Este email não possui uma assinatura válida. Entre em contato com o suporte para adquirir uma assinatura antes de criar sua conta.');
        setTimeout(() => router.push('/auth/signup'), 5000);
        return;
      }

      // Assinatura válida - redirecionar para dashboard
      router.push('/dashboard');
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        textAlign: 'center',
      }}>
        <div style={{
          backgroundColor: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '0.75rem',
          padding: '1.5rem 2rem',
          maxWidth: '480px',
        }}>
          <p style={{ color: '#dc2626', fontSize: '1rem', margin: 0 }}>
            {error}
          </p>
          <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '1rem' }}>
            Redirecionando...
          </p>
        </div>
      </div>
    );
  }

  return <LoadingScreen message="Verificando sua conta..." />;
}
