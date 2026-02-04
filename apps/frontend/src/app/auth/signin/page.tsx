'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingScreen } from '@/components/shared/LoadingScreen';
import { useTheme } from 'next-themes';
import './signin.css';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const { signIn, signInWithGoogle, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const reasonPatient = searchParams.get('reason') === 'patient';

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determinar qual tema está ativo (considerando systemTheme)
  const currentTheme = mounted ? (theme === 'system' ? systemTheme : theme) : 'light';
  const logoSrc = currentTheme === 'dark' ? '/logo-white.svg' : '/logo-black.svg';

  // Redirecionar se já estiver logado (apenas médicos; pacientes são bloqueados na área do médico)
  useEffect(() => {
    if (!authLoading && user) {
      const role = (user as { user_metadata?: { role?: string } })?.user_metadata?.role;
      if (role !== 'patient') {
        router.push('/dashboard');
      }
    }
  }, [user, authLoading, router]);

  // Função para traduzir mensagens de erro do Supabase para português
  const translateError = (errorMessage: string): string => {
    const errorLower = errorMessage.toLowerCase();
    
    if (errorLower.includes('invalid login credentials') || 
        errorLower.includes('invalid credentials') ||
        errorLower.includes('email not confirmed')) {
      return 'Email ou senha incorretos. Verifique suas credenciais e tente novamente.';
    }
    
    if (errorLower.includes('email rate limit')) {
      return 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.';
    }
    
    if (errorLower.includes('user not found')) {
      return 'Usuário não encontrado. Verifique seu email.';
    }
    
    if (errorLower.includes('password')) {
      return 'Senha incorreta. Tente novamente.';
    }
    
    // Retornar mensagem original se não houver tradução específica
    return errorMessage;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        setError(translateError(error.message));
      } else {
        // Verificar se é paciente: pacientes não têm acesso à área do médico
        const { data: { session } } = await supabase.auth.getSession();
        const role = session?.user?.user_metadata?.role;
        if (role === 'patient') {
          await supabase.auth.signOut();
          setError('Esta área é apenas para médicos. Como paciente, use o link enviado no seu email para acessar suas informações.');
          return;
        }
        router.push('/dashboard');
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };


  if (authLoading) {
    return <LoadingScreen message="Carregando..." />;
  }

  return (
    <div className="signin-page">
      <div className="signin-container">
        {/* Logo Section */}
        <div className="signin-logo-section">
          <div className="signin-logo-wrapper">
            <Image
              src={logoSrc}
              alt="TRIA Logo"
              width={220}
              height={220}
              className="signin-logo-image"
              priority
            />
          </div>
        </div>

        {/* Sign In Card */}
        <div className="signin-card">
          <div className="signin-header">
            <h2 className="signin-title">Entrar</h2>
            <p className="signin-subtitle">
              Entre com sua conta para acessar a plataforma
            </p>
          </div>

          {reasonPatient && (
            <div className="signin-info-message" style={{ background: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontSize: '14px', color: '#0369a1' }}>
              A área do médico é restrita. Como paciente, use o link enviado no seu email para acessar suas informações.
            </div>
          )}

          <div className="signin-form-wrapper">
            <form onSubmit={handleSubmit} className="signin-form">
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  disabled={loading}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  Senha
                </label>
                <div className="password-input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Sua senha"
                    required
                    disabled={loading}
                    className="form-input password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle-btn"
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? (
                      <EyeOff size={18} />
                    ) : (
                      <Eye size={18} />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="submit-button"
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="forgot-password-wrapper">
              <Link href="/auth/forgot-password" className="forgot-password-btn">
                Esqueceu sua senha?
              </Link>
            </div>

            <div className="divider-wrapper">
              <div className="divider-line"></div>
              <span className="divider-text">Ou</span>
            </div>

            <button
              type="button"
              onClick={async () => {
                setError(null);
                setGoogleLoading(true);
                try {
                  const { error } = await signInWithGoogle();
                  if (error) {
                    setError(error.message);
                    setGoogleLoading(false);
                  }
                  // Se não houver erro, o usuário será redirecionado automaticamente
                } catch (err) {
                  setError('Erro ao conectar com Google. Tente novamente.');
                  setGoogleLoading(false);
                }
              }}
              disabled={googleLoading || loading}
              className="google-button"
            >
              <svg className="google-icon" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              {googleLoading ? 'Conectando...' : 'Continuar com Google'}
            </button>

            <div className="signup-link-wrapper">
              <p className="signup-text">
                Não tem uma conta?{' '}
                <Link href="/auth/signup" className="signup-link">
                  Criar conta
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
