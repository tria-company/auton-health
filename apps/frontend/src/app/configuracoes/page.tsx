'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Phone, Stethoscope, CreditCard, Calendar, Hash, FileText } from 'lucide-react';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { formatCPF, formatPhone, validateCPF, removeMask } from '@/lib/validations';
import { supabase } from '@/lib/supabase';
import './configuracoes.css';

interface MedicoData {
  id: string;
  name: string;
  email: string;
  phone?: string;
  specialty?: string;
  crm?: string;
  cpf?: string;
  birth_date?: string;
  profile_pic?: string | null;
  subscription_type?: 'FREE' | 'PRO' | 'ENTERPRISE';
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  specialty: string;
  crm: string;
  cpf: string;
  birth_date: string;
  subscription_type: 'FREE' | 'PRO' | 'ENTERPRISE';
}

export default function ConfiguracoesPage() {
  const [medico, setMedico] = useState<MedicoData | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    specialty: '',
    crm: '',
    cpf: '',
    birth_date: '',
    subscription_type: 'FREE'
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cpfError, setCpfError] = useState<string | null>(null);

  useEffect(() => {
    fetchMedicoData();
  }, []);

  const fetchMedicoData = async () => {
    try {
      setLoading(true);
      
      // Buscar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }
      
      // Buscar dados do médico
      const { data: medico, error: medicoError } = await supabase
        .from('medicos')
        .select('*')
        .eq('user_auth', user.id)
        .single();
      
      if (medicoError || !medico) {
        throw new Error('Erro ao carregar dados do médico');
      }
      
      setMedico(medico);
      
      // Preencher formulário com dados existentes e aplicar máscaras
      setFormData({
        name: medico.name || '',
        email: medico.email || '',
        phone: medico.phone ? formatPhone(medico.phone) : '',
        specialty: medico.specialty || '',
        crm: medico.crm || '',
        cpf: medico.cpf ? formatCPF(medico.cpf) : '',
        birth_date: medico.birth_date || '',
        subscription_type: medico.subscription_type || 'FREE'
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Aplica máscaras específicas
    let formattedValue = value;
    
    if (name === 'phone') {
      formattedValue = formatPhone(value);
    } else if (name === 'cpf') {
      formattedValue = formatCPF(value);
      // Valida CPF em tempo real
      if (value.replace(/\D/g, '').length === 11) {
        if (!validateCPF(value)) {
          setCpfError('CPF inválido');
        } else {
          setCpfError(null);
        }
      } else {
        setCpfError(null);
      }
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validações antes de enviar
    if (formData.cpf && !validateCPF(formData.cpf)) {
      setError('Por favor, insira um CPF válido.');
      setCpfError('CPF inválido');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Buscar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Remove máscaras antes de enviar para o banco
      const dataToSend = {
        ...formData,
        phone: removeMask(formData.phone),
        cpf: removeMask(formData.cpf),
      };

      // Atualizar dados do médico no Supabase
      const { data: updatedMedico, error: updateError } = await supabase
        .from('medicos')
        .update(dataToSend)
        .eq('user_auth', user.id)
        .select()
        .single();

      if (updateError || !updatedMedico) {
        throw new Error(updateError?.message || 'Erro ao atualizar dados');
      }

      setMedico(updatedMedico);
      setSuccess('Dados atualizados com sucesso!');
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar dados');
    } finally {
      setSaving(false);
    }
  };

  const formatSubscriptionType = (type: string) => {
    switch (type) {
      case 'FREE': return 'Gratuito';
      case 'PRO': return 'Profissional';
      case 'ENTERPRISE': return 'Empresarial';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="configuracoes-container">
        <div className="configuracoes-header">
          <h1 className="configuracoes-title">Configurações</h1>
          <p className="configuracoes-subtitle">Gerenciando suas informações pessoais</p>
        </div>
        
        <div className="loading-indicator">
          <div className="loading-icon"></div>
          <span>Carregando dados...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="configuracoes-container">
      <div className="configuracoes-header">
        <h1 className="configuracoes-title">Configurações</h1>
        <p className="configuracoes-subtitle">Gerenciando suas informações pessoais</p>
      </div>

      <div className="consultation-form">
        <form onSubmit={handleSubmit} className="form-card">
          <div className="form-section-title">
            <User className="form-section-icon" />
            <span>Informações Pessoais</span>
          </div>

          {medico && (
            <div className="form-group" style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
              <AvatarUpload
                currentImageUrl={medico.profile_pic}
                onUploadComplete={(url) => {
                  setMedico(prev => prev ? { ...prev, profile_pic: url } : null);
                  setSuccess('Foto de perfil atualizada com sucesso!');
                  setTimeout(() => setSuccess(null), 3000);
                }}
                userId={medico.id}
                userType="medico"
                size="large"
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name" className="form-label">
              <User className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Nome Completo
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              <Mail className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone" className="form-label">
              <Phone className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Telefone
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="form-input"
              placeholder="(11) 99999-9999"
              maxLength={15}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cpf" className="form-label">
              <FileText className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              CPF
            </label>
            <input
              type="text"
              id="cpf"
              name="cpf"
              value={formData.cpf}
              onChange={handleInputChange}
              className={`form-input ${cpfError ? 'error' : ''}`}
              placeholder="000.000.000-00"
              maxLength={14}
            />
            {cpfError && (
              <div className="field-error" style={{ color: '#ef4444', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                {cpfError}
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="birth_date" className="form-label">
              <Calendar className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Data de Nascimento
            </label>
            <input
              type="date"
              id="birth_date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleInputChange}
              className="form-input"
            />
          </div>

          <div className="form-section-title" style={{ marginTop: '2rem' }}>
            <Stethoscope className="form-section-icon" />
            <span>Informações Profissionais</span>
          </div>

          <div className="form-group">
            <label htmlFor="specialty" className="form-label">
              <Stethoscope className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Especialidade
            </label>
            <input
              type="text"
              id="specialty"
              name="specialty"
              value={formData.specialty}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ex: Clínico Geral, Cardiologia, etc."
            />
          </div>

          <div className="form-group">
            <label htmlFor="crm" className="form-label">
              <Hash className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Número de Registro do Profissional
            </label>
            <input
              type="text"
              id="crm"
              name="crm"
              value={formData.crm}
              onChange={handleInputChange}
              className="form-input"
              placeholder="Ex: 12345-SP (opcional)"
            />
            <div className="form-helper-text" style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              Campo opcional. Preencha apenas se você possuir um número de registro profissional.
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="subscription_type" className="form-label">
              <CreditCard className="form-section-icon" style={{ width: '16px', height: '16px', display: 'inline', marginRight: '8px' }} />
              Tipo de Assinatura
            </label>
            <select
              id="subscription_type"
              name="subscription_type"
              value={formData.subscription_type}
              onChange={handleInputChange}
              className="form-select"
              disabled
            >
              <option value="FREE">Gratuito</option>
              <option value="PRO">Profissional</option>
              <option value="ENTERPRISE">Empresarial</option>
            </select>
            <div className="form-helper-text">
              O tipo de assinatura não pode ser alterado aqui. Entre em contato com o suporte para alterações.
            </div>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {success && (
            <div className="success-message">
              {success}
            </div>
          )}

          <div className="form-actions">
            <button 
              type="submit" 
              className="btn btn-primary btn-large"
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="loading-icon"></div>
                  Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
