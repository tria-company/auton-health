'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from 'next-themes';
import './forgot-password.css';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const { theme, systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const { resetPassword } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determinar qual tema está ativo (considerando systemTheme)
  const currentTheme = mounted ? (theme === 'system' ? systemTheme : theme) : 'light';
  const logoSrc = currentTheme === 'dark' ? '/logo-white.svg' : '/logo-black.svg';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        setError(error.message);
      } else {
        setMessage('Email de recuperação enviado! Verifique sua caixa de entrada.');
        // Opcional: redirecionar após alguns segundos
        setTimeout(() => {
          router.push('/auth/signin');
        }, 5000);
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="forgot-password-page">
      <div className="forgot-password-container">
        {/* Logo Section */}
        <div className="forgot-password-logo-section">
          <div className="forgot-password-logo-wrapper">
            <Image
              src={logoSrc}
              alt="TRIA Logo"
              width={120}
              height={120}
              className="forgot-password-logo-image"
              priority
            />
          </div>
        </div>

        {/* Forgot Password Card */}
        <div className="forgot-password-card">
          <div className="forgot-password-header">
            <h2 className="forgot-password-title">Redefinir Senha</h2>
            <p className="forgot-password-subtitle">
              Digite seu email para receber um link de recuperação de senha
            </p>
          </div>

          <div className="forgot-password-form-wrapper">
            <form onSubmit={handleSubmit} className="forgot-password-form">
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

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              {message && (
                <div className="success-message">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="submit-button"
              >
                {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
              </button>
            </form>

            <div className="back-to-signin-wrapper">
              <Link href="/auth/signin" className="back-to-signin-link">
                <ArrowLeft size={16} />
                <span>Voltar para o login</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

