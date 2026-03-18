'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Lock, Eye, EyeOff, Stethoscope, User, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTheme } from 'next-themes';
import './reset-password.css';

type UserRole = 'medico' | 'paciente' | null;

export default function ResetPasswordPage() {
  const router = useRouter();
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

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
