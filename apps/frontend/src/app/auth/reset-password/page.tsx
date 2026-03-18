'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Lock, Eye, EyeOff, Stethoscope, User, ArrowLeft, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import './reset-password.css';

type UserRole = 'medico' | 'paciente' | null;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="reset-password-page"><div style={{ textAlign: 'center', color: '#6B7280' }}>Carregando...</div></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Session state
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Step control
  const [role, setRole] = useState<UserRole>(null);

  // Form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Establish session from the recovery link
  useEffect(() => {
    let settled = false;

    // 1. Listen for PASSWORD_RECOVERY event (handles hash fragment flow)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (settled) return;
      if (event === 'PASSWORD_RECOVERY' && session) {
        settled = true;
        setSessionReady(true);
      }
    });

    // 2. Try PKCE code exchange, then fallback to existing session
    const tryEstablishSession = async () => {
      // Give onAuthStateChange a moment to fire (handles hash fragment)
      await new Promise((r) => setTimeout(r, 500));
      if (settled) return;

      const code = searchParams.get('code');

      if (code) {
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (!error) {
            settled = true;
            setSessionReady(true);
            return;
          }
          console.warn('PKCE exchange failed, checking existing session:', error.message);
        } catch (err) {
          console.warn('PKCE exchange error:', err);
        }
      }

      // Fallback: check if session was established by another means
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        settled = true;
        setSessionReady(true);
        return;
      }

      // Wait a bit more for onAuthStateChange
      await new Promise((r) => setTimeout(r, 2000));
      if (settled) return;

      setSessionError('Link de recuperação inválido ou expirado. Solicite um novo link.');
    };

    tryEstablishSession();

    return () => {
      subscription.unsubscribe();
    };
  }, [searchParams]);

  const currentTheme = mounted ? (theme === 'system' ? systemTheme : theme) : 'light';
  const logoSrc = currentTheme === 'dark' ? '/logo-white.svg' : '/logo-black.svg';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await supabase.auth.updateUser({
        password: password,
      });

      if (authError) throw authError;

      setSuccess(true);

      const redirectUrl =
        role === 'medico'
          ? 'https://autonhealth.com.br/auth/signin/'
          : 'https://pacientes.autonhealth.com.br/authentication/sign-in';

      setTimeout(() => {
        window.location.href = redirectUrl;
      }, 3000);
    } catch (err: any) {
      console.error('Erro ao redefinir senha:', err);
      setError(err.message || 'Erro ao redefinir senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Loading: exchanging code for session
  if (!sessionReady && !sessionError) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-logo-section">
            <div className="reset-password-logo-wrapper">
              <Image src={logoSrc} alt="TRIA Logo" width={120} height={120} className="reset-password-logo-image" priority />
            </div>
          </div>
          <div className="reset-password-card">
            <div className="reset-password-header" style={{ paddingBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                <Loader2 size={32} className="spinner" style={{ animation: 'spin 1s linear infinite', color: '#1B4266' }} />
              </div>
              <p className="reset-password-subtitle">Verificando link de recuperação...</p>
            </div>
          </div>
        </div>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Error: invalid or expired code
  if (sessionError) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-logo-section">
            <div className="reset-password-logo-wrapper">
              <Image src={logoSrc} alt="TRIA Logo" width={120} height={120} className="reset-password-logo-image" priority />
            </div>
          </div>
          <div className="reset-password-card">
            <div className="reset-password-header">
              <h2 className="reset-password-title">Link Expirado</h2>
            </div>
            <div className="reset-password-form-wrapper">
              <div className="error-message">{sessionError}</div>
              <div className="back-action-wrapper">
                <a href="/auth/forgot-password" className="back-action-link" style={{ textDecoration: 'none' }}>
                  <ArrowLeft size={16} />
                  <span>Solicitar novo link</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1: Role selection
  if (!role) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container">
          <div className="reset-password-logo-section">
            <div className="reset-password-logo-wrapper">
              <Image
                src={logoSrc}
                alt="TRIA Logo"
                width={120}
                height={120}
                className="reset-password-logo-image"
                priority
              />
            </div>
          </div>

          <div className="reset-password-card">
            <div className="reset-password-header">
              <h2 className="reset-password-title">Redefinir Senha</h2>
              <p className="reset-password-subtitle">
                Selecione seu perfil para continuar
              </p>
            </div>

            <div className="role-selection-wrapper">
              <div className="role-cards">
                <button
                  className="role-card"
                  onClick={() => setRole('medico')}
                >
                  <div className="role-card-icon">
                    <Stethoscope size={32} />
                  </div>
                  <span className="role-card-title">Sou Médico</span>
                  <span className="role-card-description">
                    Profissional de saúde
                  </span>
                </button>

                <button
                  className="role-card"
                  onClick={() => setRole('paciente')}
                >
                  <div className="role-card-icon">
                    <User size={32} />
                  </div>
                  <span className="role-card-title">Sou Paciente</span>
                  <span className="role-card-description">
                    Paciente da plataforma
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Password form
  return (
    <div className="reset-password-page">
      <div className="reset-password-container">
        <div className="reset-password-logo-section">
          <div className="reset-password-logo-wrapper">
            <Image
              src={logoSrc}
              alt="TRIA Logo"
              width={120}
              height={120}
              className="reset-password-logo-image"
              priority
            />
          </div>
        </div>

        <div className="reset-password-card">
          <div className="reset-password-header">
            <h2 className="reset-password-title">Nova Senha</h2>
            <p className="reset-password-subtitle">
              Digite sua nova senha para continuar
            </p>
          </div>

          <div className="reset-password-form-wrapper">
            {success ? (
              <div className="success-message">
                Senha atualizada com sucesso! Redirecionando para o login...
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="reset-password-form">
                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Nova Senha
                  </label>
                  <div className="password-input-wrapper">
                    <div className="password-input-container">
                      <Lock className="password-icon" size={20} />
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        required
                        disabled={loading}
                        className="form-input password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="password-toggle-btn"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirmar Senha
                  </label>
                  <div className="password-input-wrapper">
                    <div className="password-input-container">
                      <Lock className="password-icon" size={20} />
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Digite a senha novamente"
                        required
                        disabled={loading}
                        className="form-input password-input"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="password-toggle-btn"
                      >
                        {showConfirmPassword ? (
                          <EyeOff size={18} />
                        ) : (
                          <Eye size={18} />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {error && <div className="error-message">{error}</div>}

                <button
                  type="submit"
                  disabled={loading}
                  className="submit-button"
                >
                  {loading ? 'Atualizando...' : 'Redefinir Senha'}
                </button>
              </form>
            )}

            <div className="back-action-wrapper">
              <button
                className="back-action-link"
                onClick={() => {
                  setRole(null);
                  setPassword('');
                  setConfirmPassword('');
                  setError(null);
                }}
              >
                <ArrowLeft size={16} />
                <span>Voltar</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
