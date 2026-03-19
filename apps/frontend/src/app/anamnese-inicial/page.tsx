'use client';

import { useState, useEffect, Suspense } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { useSearchParams, useRouter } from 'next/navigation';
import { useNotifications } from '@/components/shared/NotificationSystem';
import {
  UtensilsCrossed, ArrowRight, ArrowLeft, Save, User, Ruler, Apple,
  Dumbbell, MessageSquare, Check, MapPin, ClipboardList,
  Mail, Phone, Calendar, Users, Briefcase, ChevronDown, Shield, Droplets, Heart,
  Beef, Wheat, Leaf, Bean, Grid3X3, Cherry, Moon, Clock, Camera, Pencil, X, Loader2
} from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import './anamnese-inicial.css';

interface AnamneseFormData {
  nome_completo?: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  genero?: string;
  data_nascimento?: string;
  idade?: string;
  tipo_saguineo?: string;
  estado_civil?: string;
  profissao?: string;
  altura?: string;
  peso_atual?: string;
  peso_antigo?: string;
  peso_desejado?: string;
  objetivo_principal?: string;
  patrica_atividade_fisica?: string;
  nivel_atividade?: string;
  modalidades?: string[];
  frequencia_semanal?: string;
  periodo_treino?: string;
  frequencia_deseja_treinar?: string;
  restricao_movimento?: string;
  informacoes_importantes?: string;
  NecessidadeEnergeticaDiaria?: string;
  toma_medicamentos?: string;
  medicamentos_detalhes?: string;
  suplementos?: string[];
  condicoes_diagnosticadas?: string[];
  cirurgias_anteriores?: string;
  mastigacao?: string;
  alergias_sensibilidades?: string[];
  desconfortos_intestinais?: string[];
  avaliacao_intestino?: string;
  tipo_bristol?: string;
  avaliacao_sono?: string;
  consumo_agua?: string;
  cor_urina?: string;
  pratica_jejum?: string;
  duracao_jejum?: string;
  foto_frente?: string;
  foto_costas?: string;
  foto_lateral_esq?: string;
  foto_lateral_dir?: string;
  proteinas?: string[];
  carboidratos?: string[];
  vegetais?: string[];
  leguminosas?: string[];
  gorduras?: string[];
  frutas?: string[];
}

// Opções para seleções múltiplas (simplificadas)
const proteinasOptions = [
  'Frango', 'Carne Bovina', 'Peixe', 'Ovos', 'Tofu', 'Porco', 'Frutos do Mar',
  'Ovo', 'Atum/Sardinha', 'Queijo', 'Iogurte'
];
const carboidratosOptions = [
  'Arroz Branco', 'Arroz Integral', 'Batata Doce', 'Mandioca', 'Macarrão', 'Cuscuz',
  'Aveia', 'Pão Integral', 'Inhame', 'Tapioca'
];
const vegetaisOptions = [
  'Brócolis', 'Espinafre', 'Cenoura', 'Abobrinha', 'Alface', 'Tomate', 'Beterraba',
  'Pepino', 'Vagem', 'Couve-flor'
];
const leguminosasOptions = [
  'Feijão Preto', 'Feijão Carioca', 'Grão de Bico', 'Lentilha', 'Ervilha', 'Soja', 'Edamame'
];
const gordurasOptions = [
  'Azeite de Oliva', 'Abacate', 'Castanhas', 'Pasta de Amendoim', 'Nozes',
  'Sementes (Chia/Linhaça)', 'Óleo de Coco'
];
const frutasOptions = [
  'Banana', 'Maçã', 'Mamão', 'Morango', 'Melancia', 'Laranja', 'Manga', 'Uva',
  'Abacaxi', 'Pêra', 'Kiwi'
];

// Seleção direta: UI armazena o que o paciente QUER (= mesmo formato do DB)
// Sem necessidade de inversão

const TOTAL_STEPS = 8;

function formatPhone(value: string) {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
}

function getSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function PhotoUploadCard({ label, value, pacienteId, fieldName, onChange, onRemove }: {
  label: string;
  value?: string;
  pacienteId: string;
  fieldName: string;
  onChange: (url: string) => void;
  onRemove: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) return;

    setUploading(true);
    try {
      const supabase = getSupabaseClient();
      const ext = file.name.split('.').pop();
      const fileName = `${fieldName}_${Date.now()}.${ext}`;
      const filePath = `anamnese/${pacienteId}/${fileName}`;

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      onChange(urlData.publicUrl);
    } catch (err) {
      console.error('Erro no upload:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className="wizard-photo-card">
      <div className="wizard-photo-preview">
        {uploading ? (
          <div className="wizard-photo-uploading">
            <Loader2 size={28} className="wizard-photo-spinner" />
            <span>Enviando...</span>
          </div>
        ) : value ? (
          <>
            <img src={value} alt={label} />
            <button type="button" className="wizard-photo-remove" onClick={onRemove}>
              <X size={14} />
            </button>
          </>
        ) : (
          <div className="wizard-photo-placeholder">
            <div className="wizard-photo-placeholder-icon">
              <Camera size={24} />
            </div>
            <span>Toque para adicionar</span>
          </div>
        )}
      </div>
      <div className="wizard-photo-footer">
        <span className="wizard-photo-label">{label}</span>
        <div className="wizard-photo-actions">
          <label className="wizard-photo-btn" title="Editar">
            <Pencil size={14} />
            <input type="file" accept="image/*" onChange={handleFileSelect} />
          </label>
          <label className="wizard-photo-btn" title="Tirar foto">
            <Camera size={14} />
            <input type="file" accept="image/*" capture="environment" onChange={handleFileSelect} />
          </label>
        </div>
      </div>
    </div>
  );
}

function AnamneseInicialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError } = useNotifications();
  const pacienteId = searchParams.get('paciente_id') || searchParams.get('patient_id') || searchParams.get('pacienteId');

  const [formData, setFormData] = useState<AnamneseFormData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (pacienteId) {
      fetchAnamnese();
    } else {
      showError('ID do paciente não encontrado na URL', 'Erro');
      setLoading(false);
    }
  }, [pacienteId]);

  const fetchAnamnese = async () => {
    try {
      const response = await gatewayClient.get(`/anamnese/anamnese-inicial?patient_id=${pacienteId}`);
      if (!response.success) { throw new Error(response.error || "Erro na requisição"); }
      if (response.anamnese) {
        setFormData(dbToUi(response.anamnese));
      }
      if (response.emailLocked) {
        setEmailLocked(true);
      }
    } catch (error) {
      console.error('Erro ao carregar anamnese:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof AnamneseFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleMultiSelect = (field: keyof AnamneseFormData, value: string, checked: boolean) => {
    const currentArray = (formData[field] as any[]) || [];
    if (checked) {
      handleChange(field, [...currentArray, value]);
    } else {
      handleChange(field, currentArray.filter(item => item !== value));
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

  const handleSubmit = async () => {
    if (!pacienteId) {
      showError('ID do paciente não encontrado', 'Erro');
      return;
    }
    setSaving(true);
    try {
      const dataToSave = { ...formData };
      const tipoVal = dataToSave.tipo_saguineo ?? (dataToSave as any).tipo_sanguineo;
      if (tipoVal !== undefined) dataToSave.tipo_saguineo = tipoVal;

      const saveResponse = await gatewayClient.post('/anamnese/anamnese-inicial/save', {
        paciente_id: pacienteId,
        ...dataToSave,
      });

      if (!saveResponse.success) {
        throw new Error(saveResponse.error || 'Erro ao salvar anamnese');
      }

      setSubmitted(true);
    } catch (error) {
      console.error('Erro ao salvar anamnese:', error);
      showError(`Erro ao salvar anamnese: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro');
    } finally {
      setSaving(false);
    }
  };

  const nextStep = () => { if (currentStep < TOTAL_STEPS) setCurrentStep(prev => prev + 1); };
  const prevStep = () => { if (currentStep > 0) setCurrentStep(prev => prev - 1); };

  const progress = currentStep === 0 ? 0 : (currentStep / TOTAL_STEPS) * 100;

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner" />
        <p>Carregando anamnese...</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="anamnese-wizard">
        <div className="anamnese-wizard-inner">
          <div className="wizard-success">
            <div className="wizard-success-card">
              <div className="wizard-success-icon">
                <Check size={32} />
              </div>
              <h1 className="wizard-success-title">Anamnese enviada!</h1>
              <p className="wizard-success-description">
                Obrigado por preencher. Suas informações foram registradas com sucesso e um especialista entrará em contato em breve.
              </p>
              <div className="wizard-success-summary">
                <div className="wizard-success-summary-title">Resumo do envio</div>
                <div className="wizard-success-summary-row">
                  <span className="wizard-success-summary-label">Paciente</span>
                  <span className="wizard-success-summary-value">{formData.nome_completo || '—'}</span>
                </div>
                <div className="wizard-success-summary-row">
                  <span className="wizard-success-summary-label">Altura</span>
                  <span className="wizard-success-summary-value">{formData.altura ? `${formData.altura} cm` : '—'}</span>
                </div>
                <div className="wizard-success-summary-row">
                  <span className="wizard-success-summary-label">Peso Atual</span>
                  <span className="wizard-success-summary-value">{formData.peso_atual ? `${parseFloat(formData.peso_atual).toFixed(1)} kg` : '—'}</span>
                </div>
                <div className="wizard-success-summary-row">
                  <span className="wizard-success-summary-label">Objetivo Principal</span>
                  <span className="wizard-success-summary-value">{formData.objetivo_principal || '—'}</span>
                </div>
              </div>
              <div className="wizard-success-bar" />
            </div>
            <div className="wizard-success-footer">
              <Shield className="wizard-success-footer-icon" />
              <span className="wizard-success-footer-text">Sistema Seguro</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderChipGroup = (field: keyof AnamneseFormData, options: string[]) => (
    <div className="wizard-chips">
      {options.map((item) => {
        const isSelected = ((formData[field] as string[]) || []).includes(item);
        return (
          <button
            key={item}
            type="button"
            className={`wizard-chip ${isSelected ? 'selected' : ''}`}
            onClick={() => handleMultiSelect(field, item, !isSelected)}
          >
            {item}
          </button>
        );
      })}
    </div>
  );

  const InputField = ({ icon: Icon, ...props }: any) => (
    <div className="wizard-input-group">
      <Icon className="wizard-input-icon" size={20} />
      <input {...props} />
    </div>
  );

  const SelectField = ({ icon: Icon, children, ...props }: any) => (
    <div className="wizard-input-group">
      <Icon className="wizard-input-icon" size={20} />
      <div className="wizard-select-wrapper">
        <select {...props}>{children}</select>
        <ChevronDown className="wizard-select-arrow" />
      </div>
    </div>
  );

  const NavButtons = ({ isLast = false }: { isLast?: boolean }) => (
    <div className="wizard-actions">
      <button type="button" className="wizard-btn-secondary" onClick={prevStep}>
        <ArrowLeft size={18} /> Voltar
      </button>
      {isLast ? (
        <button type="button" className="wizard-btn-primary" onClick={handleSubmit} disabled={saving}>
          {saving ? (
            <><div className="wizard-btn-spinner" /> Salvando...</>
          ) : (
            <><Save size={18} /> Salvar Anamnese</>
          )}
        </button>
      ) : (
        <button type="button" className="wizard-btn-primary" onClick={nextStep}>
          Próximo Passo <ArrowRight size={18} />
        </button>
      )}
    </div>
  );

  const StepPageHeader = ({ step }: { step: number }) => (
    <div className="step-page-header">
      <span className="step-page-badge">Passo {step} de {TOTAL_STEPS}</span>
      <div className="step-progress-bar">
        <div className="step-progress-fill" style={{ width: `${(step / TOTAL_STEPS) * 100}%` }} />
      </div>
    </div>
  );

  const renderStepContent = () => {
    switch (currentStep) {
      // === WELCOME ===
      case 0:
        return (
          <>
            {/* Welcome header with logo */}
            <div className="wizard-header">
              <div className="wizard-logo"><MapPin size={20} /></div>
              <span className="wizard-header-title">Anamnese Inicial</span>
            </div>
            <div className="wizard-header-progress">
              <div className="wizard-header-progress-fill" style={{ width: '0%' }} />
            </div>
            <div className="wizard-card">
              <div className="welcome-icon">
                <UtensilsCrossed size={28} />
              </div>
              <h1 className="welcome-title">Bem-vindo à sua Anamnese</h1>
              <p className="welcome-description">
                Responda as perguntas com calma. Seus dados serão usados exclusivamente para personalizar seu acompanhamento nutricional.
              </p>
              <div className="welcome-steps">
                <div className="welcome-step-item">
                  <span className="welcome-step-number">1</span>
                  <span className="welcome-step-label">Dados pessoais</span>
                </div>
                <div className="welcome-step-item">
                  <span className="welcome-step-number">2</span>
                  <span className="welcome-step-label">Medidas corporais</span>
                </div>
                <div className="welcome-step-item">
                  <span className="welcome-step-number">3</span>
                  <span className="welcome-step-label">Preferências e Hábitos</span>
                </div>
              </div>
              <div className="wizard-actions wizard-actions-right">
                <button type="button" className="wizard-btn-primary" onClick={nextStep}>
                  Começar <ArrowRight size={18} />
                </button>
              </div>
            </div>
            <div className="wizard-footer">
              <span className="wizard-footer-text">
                Precisa de ajuda? <a href="#" className="wizard-footer-link">Entre em contato com o suporte</a>
              </span>
            </div>
          </>
        );

      // === STEP 1: Dados Pessoais ===
      case 1:
        return (
          <>
            <StepPageHeader step={1} />
            <div className="step-content">
              <h1 className="step-title">Dados Pessoais</h1>
              <p className="step-description">Informações básicas para o seu perfil e acompanhamento nutricional.</p>

              <div className="wizard-form-grid">
                <div className="wizard-form-field">
                  <label className="wizard-field-label">Nome completo</label>
                  <InputField icon={User} type="text" value={formData.nome_completo || ''} onChange={(e: any) => handleChange('nome_completo', e.target.value)} placeholder="Digite seu nome completo" />
                </div>

                <div className="wizard-form-field">
                  <label className="wizard-field-label">E-mail</label>
                  <InputField icon={Mail} type="email" value={formData.email || ''} onChange={(e: any) => handleChange('email', e.target.value)} placeholder="seuemail@exemplo.com" disabled={emailLocked} />
                </div>

                <div className="wizard-form-row">
                  <div className="wizard-form-field">
                    <label className="wizard-field-label">WhatsApp/Telefone</label>
                    <InputField icon={Phone} type="tel" value={formData.telefone || ''} onChange={(e: any) => handleChange('telefone', formatPhone(e.target.value))} placeholder="(00) 00000-0000" maxLength={15} />
                  </div>
                  <div className="wizard-form-field">
                    <label className="wizard-field-label">Data de nascimento</label>
                    <InputField icon={Calendar} type="text" value={formData.data_nascimento || ''} onChange={(e: any) => handleChange('data_nascimento', formatDate(e.target.value))} placeholder="DD/MM/AAAA" maxLength={10} />
                  </div>
                </div>

                <div className="wizard-form-row">
                  <div className="wizard-form-field">
                    <label className="wizard-field-label">Gênero</label>
                    <SelectField icon={Users} value={formData.genero || ''} onChange={(e: any) => handleChange('genero', e.target.value)}>
                      <option value="">Selecione</option>
                      <option value="Masculino">Masculino</option>
                      <option value="Feminino">Feminino</option>
                      <option value="Outro">Outro</option>
                    </SelectField>
                  </div>
                  <div className="wizard-form-field">
                    <label className="wizard-field-label">Profissão</label>
                    <InputField icon={Briefcase} type="text" value={formData.profissao || ''} onChange={(e: any) => handleChange('profissao', e.target.value)} placeholder="Sua ocupação" />
                  </div>
                </div>
              </div>

              <NavButtons />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estão seguros e protegidos.</span>
            </div>
          </>
        );

      // === STEP 2: Medidas ===
      case 2:
        return (
          <>
            <StepPageHeader step={2} />
            <div className="step-content">
              <h1 className="step-title">Medidas</h1>
              <p className="step-description">Informe seu peso e altura para o cálculo do IMC e definição de metas.</p>

              <div className="measure-cards">
                {/* Peso atual - Slider */}
                <div className="measure-card">
                  <div className="measure-card-header">
                    <span className="measure-card-label">Peso atual (kg)</span>
                    <span className="measure-card-value">{parseFloat(formData.peso_atual || '75').toFixed(1)} kg</span>
                  </div>
                  <div className="measure-slider-container">
                    <input
                      type="range"
                      className="measure-slider"
                      min="30"
                      max="200"
                      step="0.5"
                      value={formData.peso_atual || '75'}
                      onChange={(e) => handleChange('peso_atual', e.target.value)}
                    />
                    <div className="measure-slider-labels">
                      <span className="measure-slider-label">30 kg</span>
                      <span className="measure-slider-label">200 kg</span>
                    </div>
                  </div>
                </div>

                {/* Altura - Slider */}
                <div className="measure-card">
                  <div className="measure-card-header">
                    <span className="measure-card-label">Altura (cm)</span>
                    <span className="measure-card-value">{formData.altura || '170'} cm</span>
                  </div>
                  <div className="measure-slider-container">
                    <input
                      type="range"
                      className="measure-slider"
                      min="100"
                      max="220"
                      step="1"
                      value={formData.altura || '170'}
                      onChange={(e) => handleChange('altura', e.target.value)}
                    />
                    <div className="measure-slider-labels">
                      <span className="measure-slider-label">100 cm</span>
                      <span className="measure-slider-label">220 cm</span>
                    </div>
                  </div>
                </div>

                {/* Peso desejado - Slider */}
                <div className="measure-card">
                  <div className="measure-card-header">
                    <span className="measure-card-label">Peso desejado (kg)</span>
                    <span className="measure-card-value">{parseFloat(formData.peso_desejado || '70').toFixed(1)} kg</span>
                  </div>
                  <div className="measure-slider-container">
                    <input
                      type="range"
                      className="measure-slider"
                      min="30"
                      max="200"
                      step="0.5"
                      value={formData.peso_desejado || '70'}
                      onChange={(e) => handleChange('peso_desejado', e.target.value)}
                    />
                    <div className="measure-slider-labels">
                      <span className="measure-slider-label">30 kg</span>
                      <span className="measure-slider-label">200 kg</span>
                    </div>
                  </div>
                  <p className="measure-hint">Sua meta de peso ajudara o nutricionista a planejar seu deficit calorico.</p>
                </div>
              </div>

              <NavButtons />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estão seguros e protegidos.</span>
            </div>
          </>
        );

      // === STEP 3: Fotos Corporais ===
      case 3:
        return (
          <>
            <StepPageHeader step={3} />
            <div className="step-content">
              <h1 className="step-title">Fotos Corporais</h1>
              <p className="step-description">Envie 4 fotos do seu corpo para acompanhamento da evolucao. Este passo e opcional.</p>

              <div className="wizard-photos-grid">
                {([
                  { key: 'foto_frente' as keyof AnamneseFormData, label: 'Frente fechada' },
                  { key: 'foto_costas' as keyof AnamneseFormData, label: 'Costas fechadas' },
                  { key: 'foto_lateral_esq' as keyof AnamneseFormData, label: 'Lateral esq. bracos cruzados' },
                  { key: 'foto_lateral_dir' as keyof AnamneseFormData, label: 'Lateral dir. bracos cruzados' },
                ]).map(({ key, label }) => (
                  <PhotoUploadCard
                    key={key}
                    label={label}
                    value={formData[key] as string | undefined}
                    pacienteId={pacienteId || ''}
                    fieldName={key}
                    onChange={(url) => handleChange(key, url)}
                    onRemove={() => handleChange(key, '')}
                  />
                ))}
              </div>

              <NavButtons />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estao seguros e protegidos.</span>
            </div>
          </>
        );

      // === STEP 4: Preferências e Hábitos ===
      case 4:
        return (
          <>
            <StepPageHeader step={4} />
            <div className="step-content">
              <h1 className="step-title">Preferências e Hábitos</h1>
              <p className="step-description">Selecione os alimentos que você consome habitualmente ou prefere incluir na sua dieta.</p>

              <div className="wizard-prefs-card">
                <div className="wizard-prefs-section">
                  <div className="wizard-prefs-label"><Beef className="wizard-prefs-label-icon" /> Proteínas</div>
                  {renderChipGroup('proteinas', proteinasOptions)}
                </div>

                <div className="wizard-prefs-section">
                  <div className="wizard-prefs-label"><Wheat className="wizard-prefs-label-icon" /> Carboidratos</div>
                  {renderChipGroup('carboidratos', carboidratosOptions)}
                </div>

                <div className="wizard-prefs-section">
                  <div className="wizard-prefs-label"><Leaf className="wizard-prefs-label-icon" /> Vegetais</div>
                  {renderChipGroup('vegetais', vegetaisOptions)}
                </div>

                <div className="wizard-prefs-section">
                  <div className="wizard-prefs-label"><Bean className="wizard-prefs-label-icon" /> Leguminosas</div>
                  {renderChipGroup('leguminosas', leguminosasOptions)}
                </div>

                <div className="wizard-prefs-section">
                  <div className="wizard-prefs-label"><Grid3X3 className="wizard-prefs-label-icon" /> Gorduras Boas</div>
                  {renderChipGroup('gorduras', gordurasOptions)}
                </div>

                <div className="wizard-prefs-section">
                  <div className="wizard-prefs-label"><Cherry className="wizard-prefs-label-icon" /> Frutas</div>
                  {renderChipGroup('frutas', frutasOptions)}
                </div>
              </div>

              <NavButtons />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estão seguros e protegidos.</span>
            </div>
          </>
        );

      // === STEP 5: Atividade Física e Saúde ===
      case 5:
        return (
          <>
            <StepPageHeader step={5} />
            <div className="step-content">
              <h1 className="step-title">Atividade Física e Saúde</h1>
              <p className="step-description">Conte-nos sobre sua rotina e histórico médico para personalizarmos seu plano.</p>

              <div className="wizard-form-grid">
                {/* Nível de atividade */}
                <div className="wizard-section-label">
                  <Dumbbell className="wizard-section-label-icon" /> Atividade Física
                </div>
                <div className="wizard-level-chips">
                  {['Sedentário', 'Leve', 'Moderado', 'Intenso'].map((level) => (
                    <button
                      key={level}
                      type="button"
                      className={`wizard-level-chip ${formData.nivel_atividade === level ? 'selected' : ''}`}
                      onClick={() => handleChange('nivel_atividade', level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>

                {/* Modalidades */}
                <div className="wizard-subsection-label">Modalidades</div>
                <div className="wizard-chips">
                  {['Musculação', 'Corrida', 'Caminhada', 'Natação', 'Ciclismo', 'Pilates', 'Yoga', 'Esporte coletivo', 'Dança', 'Funcional'].map((mod) => {
                    const isSelected = ((formData.modalidades as string[]) || []).includes(mod);
                    return (
                      <button
                        key={mod}
                        type="button"
                        className={`wizard-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => handleMultiSelect('modalidades', mod, !isSelected)}
                      >
                        {mod}
                      </button>
                    );
                  })}
                </div>

                {/* Frequência semanal */}
                <div className="wizard-form-field" style={{ marginTop: 20 }}>
                  <label className="wizard-field-label">Frequência semanal</label>
                  <SelectField icon={Calendar} value={formData.frequencia_semanal || ''} onChange={(e: any) => handleChange('frequencia_semanal', e.target.value)}>
                    <option value="">Selecione</option>
                    <option value="1x">1x por semana</option>
                    <option value="2x">2x por semana</option>
                    <option value="3x">3x por semana</option>
                    <option value="4x">4x por semana</option>
                    <option value="5x">5x por semana</option>
                    <option value="6x">6x por semana</option>
                    <option value="7x">Todos os dias</option>
                  </SelectField>
                </div>

                {/* Período de treino */}
                <div className="wizard-form-field" style={{ marginTop: 8 }}>
                  <label className="wizard-field-label">Período de treino</label>
                  <div className="wizard-radio-group">
                    {['Manhã', 'Tarde', 'Noite', 'Varia'].map((periodo) => (
                      <label key={periodo} className="wizard-radio-item">
                        <input
                          type="radio"
                          name="periodo_treino"
                          checked={formData.periodo_treino === periodo}
                          onChange={() => handleChange('periodo_treino', periodo)}
                        />
                        <span>{periodo}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Restrições ou dores */}
                <div className="wizard-form-field" style={{ marginTop: 8 }}>
                  <label className="wizard-field-label">Restrições ou dores</label>
                  <textarea className="wizard-textarea" value={formData.restricao_movimento || ''} onChange={(e) => handleChange('restricao_movimento', e.target.value)} rows={3} placeholder="Descreva se houver..." />
                </div>

                {/* Objetivo Principal */}
                <h3 className="wizard-form-section-title">Objetivo Principal</h3>
                <div className="wizard-form-field">
                  <SelectField icon={ClipboardList} value={formData.objetivo_principal || ''} onChange={(e: any) => handleChange('objetivo_principal', e.target.value)}>
                    <option value="">Qual seu principal objetivo?</option>
                    <option value="Emagrecimento">Emagrecimento</option>
                    <option value="Ganho de massa muscular">Ganho de massa muscular</option>
                    <option value="Manutenção de peso">Manutenção de peso</option>
                    <option value="Saúde e bem-estar">Saúde e bem-estar</option>
                    <option value="Performance esportiva">Performance esportiva</option>
                    <option value="Reeducação alimentar">Reeducação alimentar</option>
                    <option value="Controle de patologia">Controle de patologia</option>
                    <option value="Outro">Outro</option>
                  </SelectField>
                </div>
              </div>

              <NavButtons />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estão seguros e protegidos.</span>
            </div>
          </>
        );

      // === STEP 6: Saúde e Medicamentos ===
      case 6:
        return (
          <>
            <StepPageHeader step={6} />
            <div className="step-content">
              <h1 className="step-title">Saúde e medicamentos</h1>
              <p className="step-description">Informações importantes para o seu plano personalizado.</p>

              <div className="wizard-form-grid">
                {/* Toma medicamentos contínuos? */}
                <div className="wizard-form-field">
                  <label className="wizard-field-label" style={{ fontWeight: 700 }}>Toma medicamentos contínuos?</label>
                  <div className="wizard-yesno-group">
                    {['Sim', 'Não'].map((opt) => (
                      <label key={opt} className={`wizard-yesno-item ${formData.toma_medicamentos === opt ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="toma_medicamentos"
                          checked={formData.toma_medicamentos === opt}
                          onChange={() => handleChange('toma_medicamentos', opt)}
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Quais medicamentos */}
                {formData.toma_medicamentos === 'Sim' && (
                  <div className="wizard-form-field">
                    <label className="wizard-field-label">Quais medicamentos e horários?</label>
                    <textarea className="wizard-textarea" value={formData.medicamentos_detalhes || ''} onChange={(e) => handleChange('medicamentos_detalhes', e.target.value)} rows={3} placeholder="Ex: Metformina 500mg (8h e 20h), Enalapril 10mg (7h)..." />
                  </div>
                )}

                {/* Suplementos */}
                <div className="wizard-form-field" style={{ marginTop: 8 }}>
                  <label className="wizard-field-label" style={{ fontWeight: 700 }}>Suplementos que utiliza</label>
                  <div className="wizard-chips">
                    {['Whey', 'Creatina', 'Vitamina D', 'Omega 3', 'Colágeno', 'Magnésio', 'B12', 'Ferro', 'Nenhum'].map((sup) => {
                      const isSelected = ((formData.suplementos as string[]) || []).includes(sup);
                      return (
                        <button
                          key={sup}
                          type="button"
                          className={`wizard-chip ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleMultiSelect('suplementos', sup, !isSelected)}
                        >
                          {sup}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Condições diagnosticadas */}
                <div className="wizard-form-field" style={{ marginTop: 8 }}>
                  <label className="wizard-field-label" style={{ fontWeight: 700 }}>Condições diagnosticadas</label>
                  <div className="wizard-chips">
                    {['Diabetes T1', 'Diabetes T2', 'Hipertensão', 'Hipotireoidismo', 'SOP', 'Dislipidemia', 'Cardiopatia', 'Esteatose', 'Nenhuma'].map((cond) => {
                      const isSelected = ((formData.condicoes_diagnosticadas as string[]) || []).includes(cond);
                      return (
                        <button
                          key={cond}
                          type="button"
                          className={`wizard-chip ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleMultiSelect('condicoes_diagnosticadas', cond, !isSelected)}
                        >
                          {cond}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cirurgias anteriores */}
                <div className="wizard-form-field" style={{ marginTop: 8 }}>
                  <label className="wizard-field-label" style={{ fontWeight: 700 }}>Cirurgias anteriores</label>
                  <textarea className="wizard-textarea" value={formData.cirurgias_anteriores || ''} onChange={(e) => handleChange('cirurgias_anteriores', e.target.value)} rows={2} placeholder="Descreva cirurgias relevantes e o ano" />
                </div>
              </div>

              <NavButtons />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estão seguros e protegidos.</span>
            </div>
          </>
        );

      // === STEP 7: Saúde Digestiva ===
      case 7:
        return (
          <>
            <StepPageHeader step={7} />
            <div className="step-content">
              <h1 className="step-title">Saúde Digestiva</h1>
              <p className="step-description">Informações importantes para o seu plano personalizado.</p>

              <div className="wizard-form-grid">
                {/* Mastigação */}
                <div className="wizard-section-label">
                  <UtensilsCrossed className="wizard-section-label-icon" /> Mastigação e ritmo das refeições
                </div>
                <div className="wizard-radio-group">
                  {[
                    'Como rápido, quase não mastigo',
                    'Ritmo normal, mastigo razoavelmente',
                    'Como devagar, mastigo bem'
                  ].map((opt) => (
                    <label key={opt} className="wizard-radio-item">
                      <input type="radio" name="mastigacao" checked={formData.mastigacao === opt} onChange={() => handleChange('mastigacao', opt)} />
                      <span>{opt}</span>
                    </label>
                  ))}
                </div>

                {/* Alergias ou sensibilidades */}
                <div className="wizard-section-label" style={{ marginTop: 28 }}>
                  <Shield className="wizard-section-label-icon" /> Alergias ou sensibilidades
                </div>
                <div className="wizard-chips">
                  {['Lactose', 'Glúten', 'Amendoim', 'Frutos do mar', 'Ovo', 'Nenhuma'].map((item) => {
                    const isSelected = ((formData.alergias_sensibilidades as string[]) || []).includes(item);
                    return (
                      <button key={item} type="button" className={`wizard-chip ${isSelected ? 'selected' : ''}`} onClick={() => handleMultiSelect('alergias_sensibilidades', item, !isSelected)}>
                        {item}
                      </button>
                    );
                  })}
                </div>

                {/* Desconfortos intestinais */}
                <div className="wizard-section-label" style={{ marginTop: 28 }}>
                  <MessageSquare className="wizard-section-label-icon" /> Desconfortos intestinais
                </div>
                <div className="wizard-chips">
                  {['Gases', 'Inchaço', 'Constipação', 'Diarreia', 'Refluxo', 'Náusea', 'Nenhum'].map((item) => {
                    const isSelected = ((formData.desconfortos_intestinais as string[]) || []).includes(item);
                    return (
                      <button key={item} type="button" className={`wizard-chip ${isSelected ? 'selected' : ''}`} onClick={() => handleMultiSelect('desconfortos_intestinais', item, !isSelected)}>
                        {item}
                      </button>
                    );
                  })}
                </div>

                {/* Avaliação do intestino 0-10 */}
                <div style={{ marginTop: 28 }}>
                  <div className="wizard-scale-header">
                    <div className="wizard-section-label" style={{ marginBottom: 0 }}>
                      <Ruler className="wizard-section-label-icon" /> Avaliação do intestino
                    </div>
                    <span className="wizard-scale-hint">Escala 0-10</span>
                  </div>
                  <div className="wizard-scale" style={{ marginTop: 12 }}>
                    {Array.from({ length: 11 }, (_, i) => (
                      <button key={i} type="button" className={`wizard-scale-item ${formData.avaliacao_intestino === String(i) ? 'selected' : ''}`} onClick={() => handleChange('avaliacao_intestino', String(i))}>
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className="wizard-scale-labels">
                    <span className="wizard-scale-label">Péssimo</span>
                    <span className="wizard-scale-label">Ótimo</span>
                  </div>
                </div>

                {/* Escala de Bristol */}
                <div style={{ marginTop: 28 }}>
                  <div className="wizard-section-label">
                    <ClipboardList className="wizard-section-label-icon" /> Tipo de evacuação (Escala de Bristol)
                  </div>
                  <div className="wizard-bristol-grid">
                    {[
                      { type: '1', desc: 'Carocos duros e separados', svg: (
                        <svg viewBox="0 0 60 40" className="wizard-bristol-svg">
                          <circle cx="12" cy="14" r="5" fill="#5C4033"/><circle cx="26" cy="12" r="4.5" fill="#5C4033"/>
                          <circle cx="40" cy="15" r="5.5" fill="#5C4033"/><circle cx="18" cy="26" r="4" fill="#5C4033"/>
                          <circle cx="34" cy="27" r="5" fill="#5C4033"/><circle cx="48" cy="25" r="4.5" fill="#5C4033"/>
                        </svg>
                      )},
                      { type: '2', desc: 'Salsicha grumosa', svg: (
                        <svg viewBox="0 0 60 40" className="wizard-bristol-svg">
                          <path d="M8 20 C8 12, 14 10, 20 12 C26 10, 30 12, 34 11 C38 10, 42 12, 46 11 C50 10, 54 14, 54 20 C54 26, 50 30, 46 29 C42 30, 38 28, 34 29 C30 30, 26 28, 20 28 C14 30, 8 28, 8 20Z" fill="#6B4E37"/>
                          <circle cx="16" cy="17" r="3" fill="#5C4033" opacity="0.5"/><circle cx="26" cy="20" r="2.5" fill="#5C4033" opacity="0.5"/>
                          <circle cx="36" cy="18" r="3" fill="#5C4033" opacity="0.5"/><circle cx="46" cy="21" r="2.5" fill="#5C4033" opacity="0.5"/>
                        </svg>
                      )},
                      { type: '3', desc: 'Salsicha com fissuras', svg: (
                        <svg viewBox="0 0 60 40" className="wizard-bristol-svg">
                          <rect x="6" y="12" width="48" height="16" rx="8" fill="#7A5C42"/>
                          <line x1="14" y1="12" x2="16" y2="16" stroke="#5C4033" strokeWidth="1" opacity="0.6"/>
                          <line x1="24" y1="12" x2="22" y2="17" stroke="#5C4033" strokeWidth="1" opacity="0.6"/>
                          <line x1="34" y1="12" x2="36" y2="16" stroke="#5C4033" strokeWidth="1" opacity="0.6"/>
                          <line x1="44" y1="12" x2="42" y2="17" stroke="#5C4033" strokeWidth="1" opacity="0.6"/>
                          <line x1="19" y1="28" x2="21" y2="24" stroke="#5C4033" strokeWidth="1" opacity="0.6"/>
                          <line x1="38" y1="28" x2="36" y2="24" stroke="#5C4033" strokeWidth="1" opacity="0.6"/>
                        </svg>
                      )},
                      { type: '4', desc: 'Salsicha macia e lisa', svg: (
                        <svg viewBox="0 0 60 40" className="wizard-bristol-svg">
                          <rect x="6" y="13" width="48" height="14" rx="7" fill="#8B6F52"/>
                          <ellipse cx="30" cy="17" rx="20" ry="2" fill="#9B7F62" opacity="0.4"/>
                        </svg>
                      )},
                      { type: '5', desc: 'Pedacos macios, bordas nitidas', svg: (
                        <svg viewBox="0 0 60 40" className="wizard-bristol-svg">
                          <ellipse cx="14" cy="16" rx="8" ry="6" fill="#A08870"/>
                          <ellipse cx="32" cy="14" rx="9" ry="5.5" fill="#A08870"/>
                          <ellipse cx="48" cy="17" rx="7" ry="6" fill="#A08870"/>
                          <ellipse cx="22" cy="28" rx="8" ry="5" fill="#A08870"/>
                          <ellipse cx="40" cy="27" rx="7" ry="5.5" fill="#A08870"/>
                        </svg>
                      )},
                      { type: '6', desc: 'Pedacos pastosos e irregulares', svg: (
                        <svg viewBox="0 0 60 40" className="wizard-bristol-svg">
                          <path d="M10 18 C8 12, 16 10, 20 14 C22 10, 28 12, 26 16 C30 12, 36 14, 34 18 C38 14, 42 16, 40 20 C44 18, 48 22, 44 26 C48 28, 42 32, 38 28 C36 32, 30 30, 28 28 C24 32, 18 30, 16 26 C12 30, 6 26, 10 18Z" fill="#B8A590"/>
                          <circle cx="20" cy="20" r="2" fill="#A89880" opacity="0.5"/>
                          <circle cx="34" cy="22" r="1.5" fill="#A89880" opacity="0.5"/>
                        </svg>
                      )},
                      { type: '7', desc: 'Liquida, sem solidos', svg: (
                        <svg viewBox="0 0 60 40" className="wizard-bristol-svg">
                          <ellipse cx="30" cy="22" rx="24" ry="10" fill="#C8B8A8" opacity="0.6"/>
                          <ellipse cx="30" cy="20" rx="20" ry="8" fill="#C8B8A8"/>
                          <ellipse cx="26" cy="18" rx="8" ry="3" fill="#D8C8B8" opacity="0.5"/>
                        </svg>
                      )},
                    ].map((item) => (
                      <button
                        key={item.type}
                        type="button"
                        className={`wizard-bristol-item ${formData.tipo_bristol === item.type ? 'selected' : ''}`}
                        onClick={() => handleChange('tipo_bristol', item.type)}
                      >
                        <div className="wizard-bristol-svg-wrap">{item.svg}</div>
                        <span className="wizard-bristol-type">Tipo {item.type}</span>
                        <span className="wizard-bristol-desc">{item.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <NavButtons />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estão seguros e protegidos.</span>
            </div>
          </>
        );

      // === STEP 8: Sono, água e jejum (último) ===
      case 8:
        return (
          <>
            <StepPageHeader step={8} />
            <div className="step-content">
              <h1 className="step-title">Sono, água e jejum</h1>
              <p className="step-description">Entender seus hábitos de recuperação e hidratação nos ajuda a otimizar sua performance metabólica.</p>

              <div className="wizard-form-grid">
                {/* Avaliação do sono 0-10 */}
                <div>
                  <div className="wizard-scale-header">
                    <div className="wizard-section-label" style={{ marginBottom: 0 }}>
                      <Moon className="wizard-section-label-icon" /> Avaliação do sono
                    </div>
                    <span className="wizard-scale-hint">Escala 0-10</span>
                  </div>
                  <div className="wizard-scale" style={{ marginTop: 12 }}>
                    {Array.from({ length: 11 }, (_, i) => (
                      <button key={i} type="button" className={`wizard-scale-item ${formData.avaliacao_sono === String(i) ? 'selected' : ''}`} onClick={() => handleChange('avaliacao_sono', String(i))}>
                        {i}
                      </button>
                    ))}
                  </div>
                  <div className="wizard-scale-labels">
                    <span className="wizard-scale-label">Péssimo</span>
                    <span className="wizard-scale-label">Ótimo</span>
                  </div>
                </div>

                {/* Consumo diário de água */}
                <div style={{ marginTop: 24 }}>
                  <div className="wizard-section-label">
                    <Droplets className="wizard-section-label-icon" /> Consumo diário de água
                  </div>
                  <div className="wizard-chips">
                    {['< 500mL', '500mL - 1L', '1L - 1.5L', '1.5L - 2L', '2L - 2.5L', '> 2.5L'].map((opt) => (
                      <button key={opt} type="button" className={`wizard-chip ${formData.consumo_agua === opt ? 'selected' : ''}`} onClick={() => handleChange('consumo_agua', opt)}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cor da urina habitual */}
                <div style={{ marginTop: 24 }}>
                  <div className="wizard-section-label">
                    <Droplets className="wizard-section-label-icon" /> Cor da urina habitual
                  </div>
                  <div className="wizard-urine-grid">
                    {[
                      { value: 'Transparente', color: '#E8ECF0', fill: '#F0F4F8', label: 'Transparente', hint: 'Excesso de agua' },
                      { value: 'Amarelo-claro', color: '#F5E6A3', fill: '#FDF8E8', label: 'Amarelo claro', hint: 'Ideal' },
                      { value: 'Amarelo', color: '#E8C840', fill: '#FDF0C0', label: 'Amarelo', hint: 'Normal' },
                      { value: 'Amarelo escuro', color: '#D4A017', fill: '#F0D878', label: 'Amarelo escuro', hint: 'Beba mais agua' },
                      { value: 'Laranjada', color: '#E07020', fill: '#F0A060', label: 'Laranjada', hint: 'Desidratacao' },
                      { value: 'Marrom', color: '#8B5E3C', fill: '#B8845C', label: 'Marrom', hint: 'Procure um medico' },
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        className={`wizard-urine-item ${formData.cor_urina === opt.value ? 'selected' : ''}`}
                        onClick={() => handleChange('cor_urina', opt.value)}
                      >
                        <svg viewBox="0 0 48 64" className="wizard-urine-svg">
                          <path d="M12 8 L12 48 C12 54, 18 58, 24 58 C30 58, 36 54, 36 48 L36 8 Z" fill={opt.fill} stroke="#D1D5DB" strokeWidth="1.5"/>
                          <path d="M12 24 L36 24 L36 48 C36 54, 30 58, 24 58 C18 58, 12 54, 12 48 Z" fill={opt.color} opacity="0.7"/>
                          <line x1="10" y1="8" x2="38" y2="8" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                        <span className="wizard-urine-label">{opt.label}</span>
                        <span className="wizard-urine-hint">{opt.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pratica jejum intermitente? */}
                <div style={{ marginTop: 24 }}>
                  <div className="wizard-section-label">
                    <Clock className="wizard-section-label-icon" /> Pratica jejum intermitente?
                  </div>
                  <div className="wizard-radio-group">
                    {['Não', 'Sim, diariamente', 'Sim, às vezes'].map((opt) => (
                      <label key={opt} className="wizard-radio-item">
                        <input type="radio" name="pratica_jejum" checked={formData.pratica_jejum === opt} onChange={() => handleChange('pratica_jejum', opt)} />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>

                  {/* Duração do jejum (condicional) */}
                  {(formData.pratica_jejum === 'Sim, diariamente' || formData.pratica_jejum === 'Sim, às vezes') && (
                    <div className="wizard-jejum-duration">
                      <div className="wizard-jejum-duration-label">Duração média do jejum</div>
                      <div className="wizard-chips">
                        {['12h', '14h', '16h', '18h', '20h+'].map((opt) => (
                          <button key={opt} type="button" className={`wizard-chip ${formData.duracao_jejum === opt ? 'selected' : ''}`} onClick={() => handleChange('duracao_jejum', opt)}>
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <NavButtons isLast />
            </div>
            <div className="wizard-footer">
              <Shield className="wizard-footer-icon" />
              <span className="wizard-footer-text">Seus dados estão seguros e protegidos.</span>
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="anamnese-wizard">
      <div className="anamnese-wizard-inner">
        {renderStepContent()}
      </div>
    </div>
  );
}

export default function AnamneseInicialPage() {
  return (
    <Suspense fallback={
      <div className="anamnese-loading">
        <div className="loading-spinner" />
        <p>Carregando...</p>
      </div>
    }>
      <AnamneseInicialContent />
    </Suspense>
  );
}
