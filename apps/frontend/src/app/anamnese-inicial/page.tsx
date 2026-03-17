'use client';

import { useState, useEffect, Suspense } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { useSearchParams, useRouter } from 'next/navigation';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { FileText, Save, ArrowLeft } from 'lucide-react';
import './anamnese-inicial.css';

interface AnamneseFormData {
  nome_completo?: string;
  cpf?: string;
  email?: string;
  genero?: string;
  data_nascimento?: string;
  idade?: string;
  /** Coluna na tabela a_cadastro_anamnese (nome no DB: tipo_saguineo) */
  tipo_saguineo?: string;
  estado_civil?: string;
  profissao?: string;
  altura?: string;
  peso_atual?: string;
  peso_antigo?: string;
  peso_desejado?: string;
  objetivo_principal?: string;
  patrica_atividade_fisica?: string;
  frequencia_deseja_treinar?: string;
  restricao_movimento?: string;
  informacoes_importantes?: string;
  NecessidadeEnergeticaDiaria?: string;
  proteinas?: any[];
  carboidratos?: any[];
  vegetais?: any[];
  legumes?: any[];
  leguminosas?: any[];
  gorduras?: any[];
  frutas?: any[];
  /** Ervas e temperos: persistido junto com vegetais (mesma coluna) */
  ervas_temperos?: any[];
}

// Opções para seleções múltiplas (anamnese inicial)
const proteinasOptions = [
  'Peito de frango', 'Coxa e sobrecoxa de frango', 'Carne moída magra (patinho, coxão mole)', 'Bife magro (alcatra, patinho, coxão duro)',
  'Fígado bovino', 'Fígado de frango', 'Peru', 'Ovos', 'Ovos de codorna', 'Sardinha em azeite de oliva', 'Atum em azeite de oliva',
  'Tilápia', 'Salmão', 'Camarão', 'Linguado', 'Merluza', 'Pintado', 'Robalo', 'Dourado', 'Mariscos', 'Tofu', 'Edamame', 'Levedura nutricional'
];
const carboidratosOptions = [
  'Arroz branco', 'Arroz integral', 'Arroz vermelho', 'Arroz negro', 'Batata doce (incluindo batata doce roxa)', 'Batata inglesa (batata comum)',
  'Batata yacon', 'Mandioca (aipim)', 'Mandioca seca (farinha de mandioca, farinha de tapioca)', 'Mandioquinha (batata-baroa)', 'Inhame',
  'Banana-da-terra', 'Abóbora (moranga, cabotiá, jerimum)', 'Milho verde', 'Aveia sem glúten', 'Quinoa em grãos', 'Tapioca', 'Cuscuz de milho',
  'Trigo sarraceno (buckwheat)'
];
const vegetaisFolhososOptions = [
  'Alface', 'Rúcula', 'Agrião', 'Couve', 'Espinafre', 'Chicória', 'Radicchio (chicória vermelha)', 'Almeirão', 'Escarola', 'Acelga', 'Endívia', 'Folhas de beterraba'
];
const ervasTemperosOptions = ['Coentro', 'Salsa', 'Hortelã', 'Manjericão'];
const legumesOptions = [
  'Brócolis', 'Chuchu', 'Vagem', 'Abóbora (moranga, cabotiá, jerimum)', 'Berinjela', 'Palmito', 'Quiabo', 'Mandioquinha (batata-baroa)',
  'Cogumelos (shiitake, champignon, portobello etc.)', 'Ora-pro-nóbis', 'Maxixe', 'Aspargos'
];
const leguminosasOptions = [
  'Feijão carioca', 'Feijão preto', 'Feijão branco', 'Feijão fradinho', 'Feijão-de-corda', 'Feijão rosinha', 'Feijão jalo', 'Feijão manteiguinha',
  'Lentilha (vermelha e verde)', 'Grão-de-bico', 'Ervilha seca'
];
const gordurasOptions = [
  'Azeite de oliva', 'Abacate', 'Castanha-do-pará', 'Castanha de caju', 'Nozes', 'Pasta de amêndoas', 'Tahine', 'Chia', 'Linhaça',
  'Semente de abóbora', 'Semente de girassol', 'Semente de gergelim'
];
const frutasOptions = [
  'Banana', 'Maçã', 'Mamão', 'Laranja', 'Tangerina', 'Melão', 'Goiaba', 'Maracujá', 'Morango', 'Framboesa', 'Mirtilo', 'Kiwi',
  'Jabuticaba', 'Figo', 'Nectarina', 'Romã', 'Cereja', 'Pitaya'
];

// Mapeamento categoria → opções (para inversão DRY)
const categoryOptionsMap: Record<string, string[]> = {
  proteinas: proteinasOptions,
  carboidratos: carboidratosOptions,
  legumes: legumesOptions,
  leguminosas: leguminosasOptions,
  gorduras: gordurasOptions,
  frutas: frutasOptions,
};

/**
 * Inverte seleção: dado um array de itens selecionados, retorna os NÃO selecionados.
 * Usado para converter entre "o que o paciente NÃO quer" (UI) e "o que QUER" (DB).
 */
function invertSelection(selected: string[], allOptions: string[]): string[] {
  return allOptions.filter(item => !selected.includes(item));
}

/**
 * Converte dados do DB (o que DESEJA) para a UI (o que NÃO DESEJA).
 */
function dbToUi(dbData: any): any {
  const uiData = { ...dbData };
  for (const [key, options] of Object.entries(categoryOptionsMap)) {
    if (uiData[key]) {
      uiData[key] = invertSelection(dbData[key] || [], options);
    }
  }
  // Vegetais: no DB é uma coluna única, na UI é separado em folhosos + ervas/temperos
  const vegetaisDesejados: string[] = dbData.vegetais || [];
  uiData.vegetais = invertSelection(vegetaisDesejados, vegetaisFolhososOptions);
  uiData.ervas_temperos = invertSelection(vegetaisDesejados, ervasTemperosOptions);
  return uiData;
}

/**
 * Converte dados da UI (o que NÃO DESEJA) para o DB (o que DESEJA).
 */
function uiToDb(formData: any): any {
  const dbData = { ...formData };
  for (const [key, options] of Object.entries(categoryOptionsMap)) {
    if (dbData[key]) {
      dbData[key] = invertSelection(formData[key] || [], options);
    }
  }
  // Vegetais: junta folhosos + ervas/temperos invertidos na mesma coluna
  dbData.vegetais = [
    ...invertSelection(formData.vegetais || [], vegetaisFolhososOptions),
    ...invertSelection(formData.ervas_temperos || [], ervasTemperosOptions),
  ];
  // Remover campo virtual
  delete dbData.ervas_temperos;
  return dbData;
}

function AnamneseInicialContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showSuccess, showError, showWarning } = useNotifications();
  // Aceitar paciente_id, patient_id ou pacienteId (links antigos/email usavam pacienteId)
  const pacienteId = searchParams.get('paciente_id') || searchParams.get('patient_id') || searchParams.get('pacienteId');
  
  const [formData, setFormData] = useState<AnamneseFormData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [emailLocked, setEmailLocked] = useState(false);
  const [currentSection, setCurrentSection] = useState(1);

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
      const data = response;
      if (data.anamnese) {
        // Converter do formato DB (o que DESEJA) para UI (o que NÃO DESEJA)
        setFormData(dbToUi(data.anamnese));
      }
      if (data.emailLocked) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pacienteId) {
      showError('ID do paciente não encontrado', 'Erro');
      return;
    }

    setSaving(true);

    try {
      // Converter da UI (o que NÃO DESEJA) para o DB (o que DESEJA)
      const invertedFormData = uiToDb(formData);

      // Garantir tipo_saguineo (coluna no DB); valor pode vir como tipo_sanguineo no form (cache)
      const tipoVal = invertedFormData.tipo_saguineo ?? (invertedFormData as any).tipo_sanguineo;
      if (tipoVal !== undefined) invertedFormData.tipo_saguineo = tipoVal;

      // Salvar via gateway (backend usa service_role, bypassa RLS)
      // Também atualiza dados do paciente na tabela patients
      const saveResponse = await gatewayClient.post('/anamnese/anamnese-inicial/save', {
        paciente_id: pacienteId,
        ...invertedFormData,
      });

      if (!saveResponse.success) {
        throw new Error(saveResponse.error || 'Erro ao salvar anamnese');
      }

      showSuccess('Anamnese salva com sucesso!', 'Sucesso');
      setTimeout(() => {
        router.push('/');
      }, 2000);
    } catch (error) {
      console.error('Erro ao salvar anamnese:', error);
      showError(`Erro ao salvar anamnese: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, 'Erro');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="anamnese-loading">
        <div className="loading-spinner"></div>
        <p>Carregando anamnese...</p>
      </div>
    );
  }

  return (
    <div className="anamnese-container">
      <div className="anamnese-header">
        <button
          onClick={() => router.back()}
          className="btn-back"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>
        <h1 className="anamnese-title">
          <FileText className="title-icon" />
          Anamnese Inicial
        </h1>
        <p className="anamnese-subtitle">
          Preencha todas as informações solicitadas para que possamos realizar uma avaliação completa.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="anamnese-form">
        {/* INTRODUÇÃO */}
        <div className="anamnese-section">
          <h2 className="section-title">1. Introdução</h2>
          <p className="section-description">
            Vamos começar a sua anamnese?
          </p>
        </div>

        {/* DADOS CADASTRAIS */}
        <div className="anamnese-section">
          <h2 className="section-title">2. Dados Cadastrais</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="nome_completo" className="field-label">
                Nome Completo *
              </label>
              <input
                id="nome_completo"
                type="text"
                value={formData.nome_completo || ''}
                onChange={(e) => handleChange('nome_completo', e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="cpf" className="field-label">CPF *</label>
              <input
                id="cpf"
                type="text"
                value={formData.cpf || ''}
                onChange={(e) => handleChange('cpf', formatCPF(e.target.value))}
                className="form-input"
                placeholder="000.000.000-00"
                maxLength={14}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="email" className="field-label">E-mail *</label>
              <input
                id="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => handleChange('email', e.target.value)}
                className="form-input"
                required
                disabled={emailLocked}
                title={emailLocked ? 'O e-mail não pode ser alterado pois já possui acesso ao sistema' : undefined}
                style={emailLocked ? { backgroundColor: '#f0f0f0', cursor: 'not-allowed' } : undefined}
              />
            </div>

            <div className="form-field">
              <label htmlFor="genero" className="field-label">Gênero Biológico *</label>
              <select
                id="genero"
                value={formData.genero || ''}
                onChange={(e) => handleChange('genero', e.target.value)}
                className="form-input"
                required
              >
                <option value="">Selecione</option>
                <option value="Masculino">Masculino</option>
                <option value="Feminino">Feminino</option>
                <option value="Outro">Outro</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="data_nascimento" className="field-label">Data de Nascimento *</label>
              <input
                id="data_nascimento"
                type="text"
                value={formData.data_nascimento || ''}
                onChange={(e) => handleChange('data_nascimento', formatDate(e.target.value))}
                className="form-input"
                placeholder="DD/MM/AAAA"
                maxLength={10}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="idade" className="field-label">Idade *</label>
              <input
                id="idade"
                type="number"
                value={formData.idade || ''}
                onChange={(e) => handleChange('idade', e.target.value)}
                className="form-input"
                placeholder="Ex: 30"
                min="0"
                max="150"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="tipo_saguineo" className="field-label">Tipo Sanguíneo *</label>
              <select
                id="tipo_saguineo"
                value={formData.tipo_saguineo || ''}
                onChange={(e) => handleChange('tipo_saguineo', e.target.value)}
                className="form-input"
                required
              >
                <option value="">Selecione</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="estado_civil" className="field-label">Estado Civil</label>
              <select
                id="estado_civil"
                value={formData.estado_civil || ''}
                onChange={(e) => handleChange('estado_civil', e.target.value)}
                className="form-input"
              >
                <option value="">Selecione</option>
                <option value="Solteiro(a)">Solteiro(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viúvo(a)">Viúvo(a)</option>
                <option value="União Estável">União Estável</option>
              </select>
            </div>

            <div className="form-field full-width">
              <label htmlFor="profissao" className="field-label">Profissão</label>
              <input
                id="profissao"
                type="text"
                value={formData.profissao || ''}
                onChange={(e) => handleChange('profissao', e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* DADOS ANTROPOMÉTRICOS */}
        <div className="anamnese-section">
          <h2 className="section-title">3. Dados Antropométricos</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="altura" className="field-label">Altura (em CENTÍMETROS) *</label>
              <input
                id="altura"
                type="number"
                value={formData.altura || ''}
                onChange={(e) => handleChange('altura', e.target.value)}
                className="form-input"
                placeholder="Ex: 175"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="peso_atual" className="field-label">Peso Atual (em KILOGRAMAS) *</label>
              <input
                id="peso_atual"
                type="number"
                step="0.1"
                value={formData.peso_atual || ''}
                onChange={(e) => handleChange('peso_atual', e.target.value)}
                className="form-input"
                placeholder="Ex: 75.5"
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="peso_antigo" className="field-label">Peso de 5 anos atrás (em KILOGRAMAS)</label>
              <input
                id="peso_antigo"
                type="number"
                step="0.1"
                value={formData.peso_antigo || ''}
                onChange={(e) => handleChange('peso_antigo', e.target.value)}
                className="form-input"
                placeholder="Ex: 70.0"
              />
            </div>

            <div className="form-field">
              <label htmlFor="peso_desejado" className="field-label">Peso Desejado (em KILOGRAMAS)</label>
              <input
                id="peso_desejado"
                type="number"
                step="0.1"
                value={formData.peso_desejado || ''}
                onChange={(e) => handleChange('peso_desejado', e.target.value)}
                className="form-input"
                placeholder="Ex: 68.0"
              />
            </div>
          </div>
        </div>

        {/* OBJETIVOS */}
        <div className="anamnese-section">
          <h2 className="section-title">4. Objetivos</h2>
          <div className="form-field full-width">
            <label htmlFor="objetivo_principal" className="field-label">
              Qual seu principal objetivo com nossa consulta integrativa? *
            </label>
            <textarea
              id="objetivo_principal"
              value={formData.objetivo_principal || ''}
              onChange={(e) => handleChange('objetivo_principal', e.target.value)}
              className="form-textarea"
              rows={4}
              required
            />
          </div>
        </div>

        {/* PREFERÊNCIAS ALIMENTARES */}
        <div className="anamnese-section">
          <h2 className="section-title">5. Preferências Alimentares</h2>
          <p className="section-description">
            Selecione os alimentos que você <strong>NÃO deseja</strong> no seu plano alimentar:
          </p>

          <div className="preferences-grid">
            <div className="preference-group">
              <label className="preference-group-label">Proteínas</label>
              <div className="checkbox-group">
                {proteinasOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.proteinas || []).includes(item)}
                      onChange={(e) => handleMultiSelect('proteinas', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <label className="preference-group-label">Carboidratos</label>
              <div className="checkbox-group">
                {carboidratosOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.carboidratos || []).includes(item)}
                      onChange={(e) => handleMultiSelect('carboidratos', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <label className="preference-group-label">Leguminosas</label>
              <div className="checkbox-group">
                {leguminosasOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.leguminosas || []).includes(item)}
                      onChange={(e) => handleMultiSelect('leguminosas', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <label className="preference-group-label">Vegetais folhosos</label>
              <div className="checkbox-group">
                {vegetaisFolhososOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.vegetais || []).includes(item)}
                      onChange={(e) => handleMultiSelect('vegetais', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <label className="preference-group-label">Ervas e temperos</label>
              <div className="checkbox-group">
                {ervasTemperosOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.ervas_temperos || []).includes(item)}
                      onChange={(e) => handleMultiSelect('ervas_temperos', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <label className="preference-group-label">Legumes e vegetais</label>
              <div className="checkbox-group">
                {legumesOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.legumes || []).includes(item)}
                      onChange={(e) => handleMultiSelect('legumes', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <label className="preference-group-label">Gorduras saudáveis</label>
              <div className="checkbox-group">
                {gordurasOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.gorduras || []).includes(item)}
                      onChange={(e) => handleMultiSelect('gorduras', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="preference-group">
              <label className="preference-group-label">Frutas</label>
              <div className="checkbox-group">
                {frutasOptions.map((item) => (
                  <label key={item} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(formData.frutas || []).includes(item)}
                      onChange={(e) => handleMultiSelect('frutas', item, e.target.checked)}
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ATIVIDADES FÍSICAS */}
        <div className="anamnese-section">
          <h2 className="section-title">6. Atividades Físicas</h2>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="patrica_atividade_fisica" className="field-label">
                Você pratica atividades físicas? *
              </label>
              <select
                id="patrica_atividade_fisica"
                value={formData.patrica_atividade_fisica || ''}
                onChange={(e) => handleChange('patrica_atividade_fisica', e.target.value)}
                className="form-input"
                required
              >
                <option value="">Selecione</option>
                <option value="Sim">Sim</option>
                <option value="Não">Não</option>
                <option value="Às vezes">Às vezes</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="frequencia_deseja_treinar" className="field-label">
                Quantas vezes por semana pretende treinar?
              </label>
              <input
                id="frequencia_deseja_treinar"
                type="text"
                value={formData.frequencia_deseja_treinar || ''}
                onChange={(e) => handleChange('frequencia_deseja_treinar', e.target.value)}
                className="form-input"
                placeholder="Ex: 3 vezes por semana"
              />
            </div>

            <div className="form-field full-width">
              <label htmlFor="restricao_movimento" className="field-label">
                Tem alguma restrição de movimento? Dor ou desconforto físico que possa lhe limitar?
              </label>
              <textarea
                id="restricao_movimento"
                value={formData.restricao_movimento || ''}
                onChange={(e) => handleChange('restricao_movimento', e.target.value)}
                className="form-textarea"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* INFORMAÇÕES ADICIONAIS */}
        <div className="anamnese-section">
          <h2 className="section-title">7. Informações Adicionais</h2>
          <div className="form-field full-width">
            <label htmlFor="informacoes_importantes" className="field-label">
              Há alguma outra informação que você considera importante compartilhar sobre seus hábitos alimentares e atividades físicas?
            </label>
            <textarea
              id="informacoes_importantes"
              value={formData.informacoes_importantes || ''}
              onChange={(e) => handleChange('informacoes_importantes', e.target.value)}
              className="form-textarea"
              rows={4}
            />
          </div>
        </div>

        {/* Botão de Salvar */}
        <div className="form-actions">
          <button
            type="submit"
            className="btn btn-primary btn-save"
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="btn-spinner"></div>
                Salvando...
              </>
            ) : (
              <>
                <Save size={20} />
                Salvar Anamnese
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AnamneseInicialPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Carregando...
      </div>
    }>
      <AnamneseInicialContent />
    </Suspense>
  );
}

