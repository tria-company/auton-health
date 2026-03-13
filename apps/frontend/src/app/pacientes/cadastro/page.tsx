'use client';

import { useState, useRef, useEffect } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { useRouter } from 'next/navigation';
import { User, FileText, Shield, Calendar, Camera, Loader2, X, Copy, Check, Mail, CheckCircle, Clock } from 'lucide-react';
import { AvatarUpload } from '@/components/shared/AvatarUpload';
import { supabase } from '@/lib/supabase';
import Image from 'next/image';
import './cadastro.css';

interface PatientFormData {
  // Informações do Paciente
  name: string;
  phone: string;
  cep: string;
  address: string;
  city: string;
  state: string;
  birth_date: string;
  email?: string;
  gender?: 'M' | 'F' | 'O';
  
  // Histórico Médico
  allergies: string;
  medications: string;
  surgical_history: string;
  surgical_date: string;
  
  // Informação sobre Convênio
  insurance_name: string;
  cpf: string;
  validity_date: string;
  
  // Campos adicionais da tabela
  emergency_contact?: string;
  emergency_phone?: string;
  medical_history?: string;
  current_medications?: string;
  medicamento_freq?: string;
  historico_cirurgico?: string;
  data_ultima_cirurgia?: string;
  convenio?: string;
  convenio_vigencia?: string;
}

export default function CadastrarPaciente() {
  const router = useRouter();
  const { showError, showWarning, showSuccess } = useNotifications();
  const [formData, setFormData] = useState<PatientFormData>({
    name: '',
    phone: '',
    cep: '',
    address: '',
    city: '',
    state: '',
    birth_date: '',
    email: '',
    gender: undefined,
    allergies: '',
    medications: '',
    surgical_history: '',
    surgical_date: '',
    insurance_name: '',
    cpf: '',
    validity_date: '',
    emergency_contact: '',
    emergency_phone: '',
    medical_history: '',
    current_medications: '',
    medicamento_freq: '',
    historico_cirurgico: '',
    data_ultima_cirurgia: '',
    convenio: '',
    convenio_vigencia: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState<string | null>(null);
  const [loadingCep, setLoadingCep] = useState(false);
  const [sendingAnamnese, setSendingAnamnese] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [anamneseLink, setAnamneseLink] = useState<string | null>(null);
  const [anamneseStatus, setAnamneseStatus] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const handleChange = (field: keyof PatientFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '+$1 $2$3');
    } else {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '+$1 $2$3');
    }
  };

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatDate = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{2})(\d{4})/, '$1/$2/$3');
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{5})(\d{3})/, '$1-$2');
  };

  const fetchAddressByCEP = async (cep: string) => {
    // Remove formatação do CEP
    const cleanCep = cep.replace(/\D/g, '');
    
    // Verifica se o CEP tem 8 dígitos
    if (cleanCep.length !== 8) {
      return;
    }

    setLoadingCep(true);
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data: any = await response.json();
      
      if (!data.erro) {
        // Preenche automaticamente os campos de endereço
        setFormData(prev => ({
          ...prev,
          address: data.logradouro || '',
          city: data.localidade || '',
          state: data.uf || '',
        }));
      } else {
        console.warn('CEP não encontrado');
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    } finally {
      setLoadingCep(false);
    }
  };

  const handleCEPChange = (value: string) => {
    const formattedCep = formatCEP(value);
    handleChange('cep', formattedCep);
    
    // Busca endereço quando o CEP tiver 8 dígitos
    const cleanCep = value.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      fetchAddressByCEP(cleanCep);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para fazer upload de imagem antes de criar o paciente
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validações
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      showError('A imagem deve ter no máximo 5MB', 'Erro');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showError('Formato de imagem não suportado. Use JPG, PNG ou WEBP', 'Erro');
      return;
    }

    // Mostrar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setSelectedImageFile(file);
    setUploadingImage(true);

    try {
      // Gerar nome único para o arquivo (usando timestamp e random)
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const randomString = Math.random().toString(36).substring(2, 15);
      const fileName = `temp_paciente_${timestamp}_${randomString}.${fileExt}`;
      const filePath = `pacientes/temp/${fileName}`;

      // Upload do arquivo para pasta temporária
      const { error: uploadError, data } = await supabase.storage
        .from('profile_pics')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw uploadError;
      }

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('profile_pics')
        .getPublicUrl(filePath);

      setProfilePicUrl(publicUrl);
      showSuccess('Imagem carregada com sucesso!', 'Sucesso');
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      showError(`Erro ao fazer upload: ${error.message || 'Erro desconhecido'}`, 'Erro');
      setImagePreview(null);
      setSelectedImageFile(null);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setImagePreview(null);
    setSelectedImageFile(null);
    setProfilePicUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  const handleSendAnamnese = async () => {
    if (!patientId) {
      showWarning('Por favor, salve o paciente primeiro', 'Atenção');
      return;
    }

    setSendingAnamnese(true);

    try {
      // Buscar usuário autenticado
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }

      // Verificar se paciente tem email
      if (!formData.email) {
        throw new Error('Paciente não possui email cadastrado. Por favor, adicione um email antes de enviar a anamnese.');
      }

      // Criar ou atualizar anamnese inicial no Supabase (tabela correta: a_cadastro_anamnese)
      const { data: existingAnamnese } = await supabase
        .from('a_cadastro_anamnese')
        .select('*')
        .eq('paciente_id', patientId)
        .maybeSingle();

      let anamneseResult;
      
      if (existingAnamnese) {
        // Atualizar existente
        const { data, error } = await supabase
          .from('a_cadastro_anamnese')
          .update({ 
            status: 'pendente',
            updated_at: new Date().toISOString()
          })
          .eq('paciente_id', patientId)
          .select()
          .maybeSingle();
        
        if (error) throw error;
        anamneseResult = data;
      } else {
        // Criar nova
        const { data, error } = await supabase
          .from('a_cadastro_anamnese')
          .insert({
            paciente_id: patientId,
            status: 'pendente'
          })
          .select()
          .maybeSingle();
        
        if (error) throw error;
        anamneseResult = data;
      }

      // Gerar link para anamnese (usar paciente_id para a página reconhecer)
      const anamneseLink = `${window.location.origin}/anamnese-inicial?paciente_id=${patientId}`;
      setAnamneseLink(anamneseLink);
      
      // Buscar status da anamnese
      if (anamneseResult?.status) {
        setAnamneseStatus(anamneseResult.status);
      }

      // Enviar email via API do gateway
      const emailResponse = await gatewayClient.post('/email/anamnese', {
        to: formData.email,
        patientName: formData.name,
        anamneseLink
      });
      
      if (emailResponse.success) {
        showSuccess('Anamnese enviada por email com sucesso!', 'Anamnese Enviada');
      } else {
        showWarning(
          `Anamnese criada, mas email não foi enviado: ${emailResponse.error || 'Erro desconhecido'}. Use o botão abaixo para copiar o link.`,
          'Atenção'
        );
      }
    } catch (error) {
      console.error('Erro ao enviar anamnese:', error);
      showError(`Erro ao enviar anamnese: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro');
    } finally {
      setSendingAnamnese(false);
    }
  };

  const handleCopyAnamneseLink = async () => {
    if (!anamneseLink && !patientId) {
      showWarning('Nenhum link disponível. Envie a anamnese primeiro.', 'Atenção');
      return;
    }

    // Se não tiver link armazenado, gerar baseado no patientId
    const linkToCopy = anamneseLink || `${window.location.origin}/anamnese-inicial?paciente_id=${patientId}`;

    try {
      await navigator.clipboard.writeText(linkToCopy);
      setLinkCopied(true);
      showSuccess('Link copiado para a área de transferência!', 'Link Copiado');
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      console.error('Erro ao copiar link:', err);
      showError('Erro ao copiar link. Tente novamente.', 'Erro');
    }
  };

  // Buscar status da anamnese quando patientId estiver disponível
  const fetchAnamneseStatus = async () => {
    if (!patientId) return;

    try {
      const response = await gatewayClient.get(`/anamnese/anamnese-inicial?patient_id=${patientId}`);
      if (response.success) {
        const data = response;
        if (data.anamnese) {
          setAnamneseStatus(data.anamnese.status);
          
          // Gerar link se anamnese existir
          const baseUrl = window.location.origin;
          setAnamneseLink(`${baseUrl}/anamnese-inicial?paciente_id=${patientId}`);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar status da anamnese:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validação básica
      if (!formData.name.trim()) {
        showWarning('Nome é obrigatório', 'Validação');
        return;
      }

      // Se houver imagem selecionada mas ainda não foi feito upload, fazer upload agora
      let finalProfilePicUrl = profilePicUrl;
      if (selectedImageFile && !profilePicUrl) {
        // Fazer upload da imagem antes de criar o paciente
        const fileExt = selectedImageFile.name.split('.').pop();
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 15);
        const fileName = `temp_paciente_${timestamp}_${randomString}.${fileExt}`;
        const filePath = `pacientes/temp/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
          .from('profile_pics')
          .upload(filePath, selectedImageFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error(`Erro ao fazer upload da imagem: ${uploadError.message}`);
        }

        const { data: { publicUrl } } = supabase.storage
          .from('profile_pics')
          .getPublicUrl(filePath);

        finalProfilePicUrl = publicUrl;
      }

      // Preparar dados para envio - mapear campos do formulário para campos da tabela
      const patientData = {
        name: formData.name.trim(),
        email: formData.email?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        cep: formData.cep?.replace(/\D/g, '') || undefined,
        address: formData.address?.trim() || undefined,
        city: formData.city?.trim() || undefined,
        state: formData.state?.trim() || undefined,
        birth_date: formData.birth_date ? convertDateToISO(formData.birth_date) : undefined,
        gender: formData.gender,
        cpf: formData.cpf?.trim() || undefined,
        emergency_contact: formData.emergency_contact?.trim() || undefined,
        emergency_phone: formData.emergency_phone?.trim() || undefined,
        medical_history: formData.medical_history?.trim() || undefined,
        allergies: formData.allergies?.trim() || undefined,
        current_medications: formData.medications?.trim() || undefined,
        medicamento_freq: formData.medicamento_freq?.trim() || undefined,
        historico_cirurgico: formData.surgical_history?.trim() || undefined,
        data_ultima_cirurgia: formData.surgical_date ? convertDateToISO(formData.surgical_date) : undefined,
        convenio: formData.convenio?.trim() || undefined,
        convenio_vigencia: formData.convenio_vigencia ? convertDateToISO(formData.convenio_vigencia) : undefined,
        profile_pic: finalProfilePicUrl || undefined
      };

      // Remover campos vazios/undefined
      Object.keys(patientData).forEach(key => {
        const value = (patientData as any)[key];
        if (value === '' || value === undefined || value === null) {
          delete (patientData as any)[key];
        }
      });

      console.log('Dados do paciente para envio:', patientData);

      // Criar paciente via Gateway (tabela patients no Supabase)
      const response = await gatewayClient.post<{ patient: { id: string } }>('/patients', patientData);

      if (!response.success || !response.patient) {
        throw new Error((response as { error?: string }).error || 'Erro ao cadastrar paciente');
      }

      const patient = response.patient;

      console.log('Paciente cadastrado com sucesso:', patient);
      
      // Salvar ID do paciente para upload de avatar e permitir enviar anamnese
      if (patient && patient.id) {
        setPatientId(patient.id);
        // Buscar status da anamnese após criar paciente
        setTimeout(() => {
          fetchAnamneseStatus();
        }, 500);
        // Não redireciona imediatamente, permite que o médico envie anamnese se quiser
        showSuccess('Paciente cadastrado com sucesso!', 'Sucesso');
      } else {
        router.push('/pacientes');
      }
    } catch (error) {
      console.error('Erro ao cadastrar paciente:', error);
      showError(`Erro ao cadastrar paciente: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro ao Cadastrar');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Função para converter data do formato DD/MM/YYYY para YYYY-MM-DD
  const convertDateToISO = (dateString: string): string | undefined => {
    if (!dateString) return undefined;
    
    // Remover caracteres não numéricos
    const cleanDate = dateString.replace(/\D/g, '');
    
    // Verificar se tem 8 dígitos (DDMMYYYY)
    if (cleanDate.length === 8) {
      const day = cleanDate.substring(0, 2);
      const month = cleanDate.substring(2, 4);
      const year = cleanDate.substring(4, 8);
      
      // Validar data básica
      const dayNum = parseInt(day);
      const monthNum = parseInt(month);
      const yearNum = parseInt(year);
      
      if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
        return `${year}-${month}-${day}`;
      }
    }
    
    return undefined;
  };


  return (
    <div className="cadastro-container">
      <div className="cadastro-header">
        <h1 className="cadastro-title">Adicionar Novo Paciente</h1>
      </div>

      <form onSubmit={handleSubmit} className="cadastro-form">
        {/* Informações do Paciente */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon-wrapper">
              <User className="section-icon" />
            </div>
            <h2 className="section-title">Informações do Paciente</h2>
          </div>

          {/* Upload de Imagem - Disponível antes e depois do cadastro */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem', position: 'relative' }}>
            <div 
              style={{
                position: 'relative',
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                overflow: 'hidden',
                cursor: uploadingImage ? 'wait' : 'pointer',
                border: '3px solid #e5e7eb',
                transition: 'all 0.3s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f9fafb'
              }}
              onClick={handleImageClick}
              onMouseEnter={(e) => {
                if (!uploadingImage) {
                  e.currentTarget.style.borderColor = '#1B4266';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(27, 66, 102, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#e5e7eb';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {imagePreview || profilePicUrl ? (
                <>
                  <Image
                    src={imagePreview || profilePicUrl || ''}
                    alt="Foto do paciente"
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                  {!uploadingImage && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      opacity: 0,
                      transition: 'opacity 0.3s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                    >
                      <Camera size={24} color="white" />
                    </div>
                  )}
                  {!uploadingImage && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveImage();
                      }}
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        backgroundColor: '#ef4444',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                      }}
                      title="Remover imagem"
                    >
                      <X size={16} />
                    </button>
                  )}
                </>
              ) : (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  color: '#6b7280'
                }}>
                  {uploadingImage ? (
                    <Loader2 size={32} className="spinning" style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Camera size={32} />
                      <span style={{ fontSize: '12px', textAlign: 'center' }}>Adicionar Foto</span>
                    </>
                  )}
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/jpg,image/webp"
              onChange={handleImageSelect}
              disabled={uploadingImage}
              style={{ display: 'none' }}
            />
          </div>

          {/* AvatarUpload para depois do cadastro (opcional - para atualizar) */}
          {patientId && profilePicUrl && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
              <AvatarUpload
                currentImageUrl={profilePicUrl}
                onUploadComplete={(url) => {
                  setProfilePicUrl(url);
                }}
                userId={patientId}
                userType="paciente"
                size="large"
              />
            </div>
          )}

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="name" className="field-label">Nome Completo</label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="form-input"
                placeholder="Felipe Porto de Oliveira"
              />
            </div>

            <div className="form-field">
              <label htmlFor="phone" className="field-label">Número de Telefone</label>
              <div className="phone-input-wrapper">
                <span className="phone-flag">🇧🇷</span>
                <input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange('phone', formatPhone(e.target.value))}
                  className="form-input phone-input"
                  placeholder="+62 878299910122"
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="cep" className="field-label">CEP</label>
              <input
                id="cep"
                type="text"
                value={formData.cep}
                onChange={(e) => handleCEPChange(e.target.value)}
                className="form-input"
                placeholder="00000-000"
                maxLength={9}
                disabled={loadingCep}
              />
              {loadingCep && (
                <span style={{ fontSize: '12px', color: '#666', marginTop: '4px', display: 'block' }}>
                  Buscando endereço...
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="address" className="field-label">Endereço</label>
              <input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => handleChange('address', e.target.value)}
                className="form-input"
                placeholder="Av. Alameda Tocantins, 125"
              />
            </div>

            <div className="form-field">
              <label htmlFor="city" className="field-label">Cidade</label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                className="form-input"
                placeholder="São Paulo"
              />
            </div>

            <div className="form-field">
              <label htmlFor="state" className="field-label">Estado</label>
              <input
                id="state"
                type="text"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value.toUpperCase())}
                className="form-input"
                placeholder="SP"
                maxLength={2}
              />
            </div>

            <div className="form-field">
              <label htmlFor="email" className="field-label">Email</label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="form-input"
                placeholder="paciente@email.com"
              />
            </div>


            <div className="form-field">
              <label htmlFor="gender" className="field-label">Sexo</label>
              <select
                id="gender"
                value={formData.gender || ''}
                onChange={(e) => handleChange('gender', e.target.value as 'M' | 'F' | 'O')}
                className="form-input"
              >
                <option value="">Selecione</option>
                <option value="M">Masculino</option>
                <option value="F">Feminino</option>
                <option value="O">Outro</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="birth_date" className="field-label">Data de Nascimento</label>
              <div className="date-input-wrapper">
                <input
                  id="birth_date"
                  type="text"
                  value={formData.birth_date}
                  onChange={(e) => handleChange('birth_date', formatDate(e.target.value))}
                  className="form-input"
                  placeholder="25/04/2019"
                  maxLength={10}
                />
                <Calendar className="date-icon" />
              </div>
            </div>

          </div>

        </div>

        {/* Histórico Médico */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon-wrapper">
              <FileText className="section-icon" />
            </div>
            <h2 className="section-title">Histórico Médico</h2>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="allergies" className="field-label">Alergias</label>
              <textarea
                id="allergies"
                value={formData.allergies}
                onChange={(e) => handleChange('allergies', e.target.value)}
                className="form-textarea"
                placeholder="Liste aqui suas alergias"
                rows={3}
              />
            </div>

            <div className="form-field">
              <label htmlFor="medications" className="field-label">Medicações Atuais</label>
              <textarea
                id="medications"
                value={formData.medications}
                onChange={(e) => handleChange('medications', e.target.value)}
                className="form-textarea"
                placeholder="Metacam 1.5mg/mL"
                rows={3}
              />
            </div>


            <div className="form-field">
              <label htmlFor="medical_history" className="field-label">Histórico Médico</label>
              <textarea
                id="medical_history"
                value={formData.medical_history}
                onChange={(e) => handleChange('medical_history', e.target.value)}
                className="form-textarea"
                placeholder="Doenças prévias, cirurgias, etc."
                rows={3}
              />
            </div>

            <div className="form-field-row">
              <div className="form-field">
                <label htmlFor="surgical_history" className="field-label">Histórico Cirúrgico</label>
                <textarea
                  id="surgical_history"
                  value={formData.surgical_history}
                  onChange={(e) => handleChange('surgical_history', e.target.value)}
                  className="form-textarea"
                  placeholder="Liste aqui"
                  rows={3}
                />
              </div>

              <div className="form-field">
                <label htmlFor="surgical_date" className="field-label">Data Cirúrgica</label>
                <div className="date-input-wrapper">
                  <input
                    id="surgical_date"
                    type="text"
                    value={formData.surgical_date}
                    onChange={(e) => handleChange('surgical_date', formatDate(e.target.value))}
                    className="form-input"
                    placeholder="25/04/2019"
                    maxLength={10}
                  />
                  <Calendar className="date-icon" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Informação sobre Convênio */}
        <div className="form-section">
          <div className="section-header">
            <div className="section-icon-wrapper">
              <Shield className="section-icon" />
            </div>
            <h2 className="section-title">Informação sobre Convênio</h2>
          </div>

          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="cpf" className="field-label">CPF</label>
              <input
                id="cpf"
                type="text"
                value={formData.cpf}
                onChange={(e) => handleChange('cpf', formatCPF(e.target.value))}
                className="form-input"
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>

            <div className="form-field">
              <label htmlFor="convenio" className="field-label">Nome do Convênio</label>
              <input
                id="convenio"
                type="text"
                value={formData.convenio}
                onChange={(e) => handleChange('convenio', e.target.value)}
                className="form-input"
                placeholder="Amil"
              />
            </div>

            <div className="form-field">
              <label htmlFor="convenio_vigencia" className="field-label">Data de Vigência do Convênio</label>
              <div className="date-input-wrapper">
                <input
                  id="convenio_vigencia"
                  type="text"
                  value={formData.convenio_vigencia}
                  onChange={(e) => handleChange('convenio_vigencia', formatDate(e.target.value))}
                  className="form-input"
                  placeholder="25/04/2025"
                  maxLength={10}
                />
                <Calendar className="date-icon" />
              </div>
            </div>
          </div>
        </div>

        {/* Status da Anamnese (se paciente já foi cadastrado) */}
        {patientId && anamneseStatus && (
          <div className="form-section" style={{ 
            backgroundColor: anamneseStatus === 'preenchida' ? '#f0fdf4' : '#fef3c7',
            border: `1px solid ${anamneseStatus === 'preenchida' ? '#86efac' : '#fcd34d'}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ margin: 0, marginBottom: '4px', fontSize: '16px', fontWeight: '600' }}>
                  Status da Anamnese Inicial
                </h3>
                <p style={{ margin: 0, fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {anamneseStatus === 'preenchida' ? (
                    <>
                      <CheckCircle size={16} />
                      <span>Anamnese já foi preenchida pelo paciente</span>
                    </>
                  ) : anamneseStatus === 'pendente' ? (
                    <>
                      <Clock size={16} />
                      <span>Anamnese pendente - aguardando preenchimento</span>
                    </>
                  ) : (
                    <span>Status: {anamneseStatus}</span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="form-actions">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn btn-secondary"
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="btn-spinner"></div>
                Salvando...
              </>
            ) : (
              'Salvar Paciente'
            )}
          </button>

          {patientId && (
            <>
              <button
                type="button"
                onClick={handleSendAnamnese}
                className="btn btn-secondary"
                disabled={sendingAnamnese || isSubmitting}
                style={{
                  marginLeft: '12px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none'
                }}
              >
                {sendingAnamnese ? (
                  <>
                    <div className="btn-spinner"></div>
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail size={16} style={{ marginRight: '8px' }} />
                    Enviar por Email
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleCopyAnamneseLink}
                className="btn btn-secondary"
                disabled={isSubmitting}
                style={{
                  marginLeft: '12px',
                  backgroundColor: linkCopied ? '#10b981' : '#6b7280',
                  color: 'white',
                  border: 'none'
                }}
              >
                {linkCopied ? (
                  <>
                    <Check size={16} style={{ marginRight: '8px' }} />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy size={16} style={{ marginRight: '8px' }} />
                    Copiar Link
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </form>

    </div>
  );
}

