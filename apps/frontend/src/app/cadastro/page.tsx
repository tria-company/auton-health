'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Search, Plus, Star, Pencil, Trash2, X, ChevronDown,
  UtensilsCrossed, Dumbbell, Pill, Leaf, UserPlus, Filter,
  Clock, Flame, Weight, ArrowRight, Building2
} from 'lucide-react';
import { PatientForm } from '@/components/patients/PatientForm';
import { useNotifications } from '@/components/shared/NotificationSystem';
import { useAuth } from '@/hooks/useAuth';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';
import ClinicManagementPage from '@/app/clinica/gestao/page';
import './cadastro.css';

// Types
interface CadastroItem {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  favorito: boolean;
  created_at: string;
  tags: string[];
  // Refeicao fields
  calorias?: number;
  proteinas?: number;
  carboidratos?: number;
  gorduras?: number;
  tempo_preparo?: string;
  // Treino fields
  grupo_muscular?: string;
  series?: number;
  repeticoes?: string;
  descanso?: string;
  equipamento?: string;
  // Suplemento/Fitoterapico fields
  dosagem?: string;
  horario?: string;
  objetivo?: string;
}

type TabType = 'pacientes' | 'refeicoes' | 'treinos' | 'suplementos' | 'fitoterapicos' | 'clinica';

const TABS: { key: TabType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { key: 'pacientes', label: 'Pacientes', icon: UserPlus },
  { key: 'refeicoes', label: 'Refeicoes', icon: UtensilsCrossed },
  { key: 'treinos', label: 'Treinos', icon: Dumbbell },
  { key: 'suplementos', label: 'Suplementos', icon: Pill },
  { key: 'fitoterapicos', label: 'Fitoterapicos', icon: Leaf },
  { key: 'clinica', label: 'Gestao de Clinica', icon: Building2, adminOnly: true },
];

// Mock data for demo - will be replaced by API calls
const INITIAL_DATA: Record<TabType, CadastroItem[]> = {
  clinica: [],
  pacientes: [],
  refeicoes: [
    {
      id: '1', nome: 'Frango grelhado com batata doce', categoria: 'Almoco',
      descricao: 'Peito de frango grelhado com temperos naturais, acompanhado de batata doce assada e salada verde.',
      favorito: true, created_at: '2026-03-15', tags: ['Alta proteina', 'Low carb'],
      calorias: 420, proteinas: 45, carboidratos: 35, gorduras: 10, tempo_preparo: '30 min'
    },
    {
      id: '2', nome: 'Omelete de claras com aveia', categoria: 'Cafe da manha',
      descricao: 'Omelete feito com claras de ovo, aveia e espinafre. Rico em proteinas e fibras.',
      favorito: false, created_at: '2026-03-14', tags: ['Cafe da manha', 'Proteico'],
      calorias: 280, proteinas: 28, carboidratos: 22, gorduras: 8, tempo_preparo: '15 min'
    },
    {
      id: '3', nome: 'Bowl de acai com granola', categoria: 'Lanche',
      descricao: 'Acai puro batido com banana, coberto com granola caseira e frutas frescas.',
      favorito: true, created_at: '2026-03-13', tags: ['Energia', 'Pre-treino'],
      calorias: 350, proteinas: 8, carboidratos: 55, gorduras: 12, tempo_preparo: '10 min'
    },
  ],
  treinos: [
    {
      id: '1', nome: 'Supino reto com halter', categoria: 'Peito',
      descricao: 'Manter escapulas estabilizadas, amplitude total, controle na descida.',
      favorito: true, created_at: '2026-03-15', tags: ['Intermediario', 'Hipertrofia'],
      grupo_muscular: 'Peitoral', series: 4, repeticoes: '8-12', descanso: '90s', equipamento: 'Halter'
    },
    {
      id: '2', nome: 'Agachamento livre', categoria: 'Pernas',
      descricao: 'Descer ate paralelo ou abaixo, joelhos alinhados com os pes, tronco ereto.',
      favorito: true, created_at: '2026-03-14', tags: ['Avancado', 'Forca'],
      grupo_muscular: 'Quadriceps', series: 4, repeticoes: '6-10', descanso: '120s', equipamento: 'Barra'
    },
    {
      id: '3', nome: 'Remada curvada', categoria: 'Costas',
      descricao: 'Puxar a barra ate o abdomen, manter as costas retas, contrair escapulas.',
      favorito: false, created_at: '2026-03-13', tags: ['Intermediario', 'Hipertrofia'],
      grupo_muscular: 'Dorsal', series: 3, repeticoes: '10-12', descanso: '90s', equipamento: 'Barra'
    },
  ],
  suplementos: [
    {
      id: '1', nome: 'Creatina Monohidratada', categoria: 'Performance',
      descricao: 'Melhora a performance em exercicios de alta intensidade e auxilia no ganho de massa muscular.',
      favorito: true, created_at: '2026-03-15', tags: ['Essencial', 'Diario'],
      dosagem: '5g/dia', horario: 'Pos-treino', objetivo: 'Ganho de forca e massa muscular'
    },
    {
      id: '2', nome: 'Whey Protein Isolado', categoria: 'Proteina',
      descricao: 'Proteina de rapida absorcao para recuperacao muscular pos-treino.',
      favorito: true, created_at: '2026-03-14', tags: ['Pos-treino', 'Proteico'],
      dosagem: '30g', horario: 'Pos-treino imediato', objetivo: 'Recuperacao muscular'
    },
    {
      id: '3', nome: 'Vitamina D3', categoria: 'Vitamina',
      descricao: 'Fundamental para a saude ossea, imunidade e regulacao hormonal.',
      favorito: false, created_at: '2026-03-13', tags: ['Saude', 'Imunidade'],
      dosagem: '2000 UI/dia', horario: 'Com o cafe', objetivo: 'Saude geral e imunidade'
    },
  ],
  fitoterapicos: [
    {
      id: '1', nome: 'Ashwagandha KSM-66', categoria: 'Adaptogeno',
      descricao: 'Reducao do estresse cronico, suporte adaptogenico, melhora do padrao de exaustao.',
      favorito: true, created_at: '2026-03-15', tags: ['Estresse', 'Adaptogeno'],
      dosagem: '600mg/dia (2x 300mg)', horario: '08:00 e 15:00, com alimento', objetivo: 'Reducao de estresse e fadiga'
    },
    {
      id: '2', nome: 'Rhodiola Rosea', categoria: 'Adaptogeno',
      descricao: 'Apoio a resiliencia psiquica, melhora cognitiva e reducao de sintomas depressivos.',
      favorito: false, created_at: '2026-03-14', tags: ['Cognitivo', 'Energia'],
      dosagem: '200mg/dia', horario: '09:00-10:00, longe de cafe', objetivo: 'Resiliencia e foco mental'
    },
    {
      id: '3', nome: 'Valeriana', categoria: 'Calmante',
      descricao: 'Auxilia na qualidade do sono e reducao da ansiedade leve a moderada.',
      favorito: true, created_at: '2026-03-13', tags: ['Sono', 'Relaxante'],
      dosagem: '300-600mg', horario: '1h antes de dormir', objetivo: 'Melhora do sono'
    },
  ],
};

export default function CadastroPage() {
  const [activeTab, setActiveTab] = useState<TabType>('refeicoes');
  const [data, setData] = useState<Record<TabType, CadastroItem[]>>(INITIAL_DATA);
  const [search, setSearch] = useState('');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showPatientForm, setShowPatientForm] = useState(false);
  const [editingItem, setEditingItem] = useState<CadastroItem | null>(null);
  const [isClinicAdmin, setIsClinicAdmin] = useState(false);
  const { showSuccess, showError } = useNotifications();
  const { user } = useAuth();

  // Check clinic admin permission
  useEffect(() => {
    const checkClinicAdmin = async () => {
      if (!user?.id) { setIsClinicAdmin(false); return; }
      try {
        const { data, error } = await supabase
          .from('medicos')
          .select('admin, clinica_admin')
          .eq('user_auth', user.id)
          .maybeSingle();
        if (error) { setIsClinicAdmin(false); return; }
        setIsClinicAdmin(data?.clinica_admin === true || data?.admin === true);
      } catch { setIsClinicAdmin(false); }
    };
    checkClinicAdmin();
  }, [user?.id]);

  // Persist data to localStorage so FavoritesPanel in consultas can read it
  useEffect(() => {
    try {
      localStorage.setItem('cadastro_data', JSON.stringify(data));
    } catch (e) {
      console.error('Erro ao salvar cadastro no localStorage:', e);
    }
  }, [data]);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('cadastro_data');
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(prev => ({ ...prev, ...parsed }));
      }
    } catch (e) {
      console.error('Erro ao carregar cadastro do localStorage:', e);
    }
  }, []);

  // Form state
  const [formData, setFormData] = useState({
    nome: '', categoria: '', descricao: '', favorito: false,
    calorias: '', proteinas: '', carboidratos: '', gorduras: '', tempo_preparo: '',
    grupo_muscular: '', series: '', repeticoes: '', descanso: '', equipamento: '',
    dosagem: '', horario: '', objetivo: '',
  });

  const items = data[activeTab] || [];

  const filteredItems = items.filter(item => {
    const matchesSearch = item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.descricao.toLowerCase().includes(search.toLowerCase()) ||
      item.categoria.toLowerCase().includes(search.toLowerCase());
    const matchesFavorite = showFavoritesOnly ? item.favorito : true;
    return matchesSearch && matchesFavorite;
  });

  const toggleFavorite = (id: string) => {
    setData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map(item =>
        item.id === id ? { ...item, favorito: !item.favorito } : item
      )
    }));
  };

  const deleteItem = (id: string) => {
    setData(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(item => item.id !== id)
    }));
    showSuccess('Item removido com sucesso');
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      nome: '', categoria: '', descricao: '', favorito: false,
      calorias: '', proteinas: '', carboidratos: '', gorduras: '', tempo_preparo: '',
      grupo_muscular: '', series: '', repeticoes: '', descanso: '', equipamento: '',
      dosagem: '', horario: '', objetivo: '',
    });
    setShowModal(true);
  };

  const openEditModal = (item: CadastroItem) => {
    setEditingItem(item);
    setFormData({
      nome: item.nome, categoria: item.categoria, descricao: item.descricao, favorito: item.favorito,
      calorias: item.calorias?.toString() || '', proteinas: item.proteinas?.toString() || '',
      carboidratos: item.carboidratos?.toString() || '', gorduras: item.gorduras?.toString() || '',
      tempo_preparo: item.tempo_preparo || '',
      grupo_muscular: item.grupo_muscular || '', series: item.series?.toString() || '',
      repeticoes: item.repeticoes || '', descanso: item.descanso || '', equipamento: item.equipamento || '',
      dosagem: item.dosagem || '', horario: item.horario || '', objetivo: item.objetivo || '',
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.nome.trim()) {
      showError('Nome e obrigatorio');
      return;
    }

    const newItem: CadastroItem = {
      id: editingItem?.id || Date.now().toString(),
      nome: formData.nome,
      categoria: formData.categoria,
      descricao: formData.descricao,
      favorito: formData.favorito,
      created_at: editingItem?.created_at || new Date().toISOString().split('T')[0],
      tags: formData.categoria ? [formData.categoria] : [],
      ...(activeTab === 'refeicoes' && {
        calorias: formData.calorias ? parseInt(formData.calorias) : undefined,
        proteinas: formData.proteinas ? parseInt(formData.proteinas) : undefined,
        carboidratos: formData.carboidratos ? parseInt(formData.carboidratos) : undefined,
        gorduras: formData.gorduras ? parseInt(formData.gorduras) : undefined,
        tempo_preparo: formData.tempo_preparo,
      }),
      ...(activeTab === 'treinos' && {
        grupo_muscular: formData.grupo_muscular,
        series: formData.series ? parseInt(formData.series) : undefined,
        repeticoes: formData.repeticoes,
        descanso: formData.descanso,
        equipamento: formData.equipamento,
      }),
      ...((activeTab === 'suplementos' || activeTab === 'fitoterapicos') && {
        dosagem: formData.dosagem,
        horario: formData.horario,
        objetivo: formData.objetivo,
      }),
    };

    setData(prev => ({
      ...prev,
      [activeTab]: editingItem
        ? prev[activeTab].map(item => item.id === editingItem.id ? newItem : item)
        : [...prev[activeTab], newItem]
    }));

    setShowModal(false);
    showSuccess(editingItem ? 'Item atualizado com sucesso' : 'Item cadastrado com sucesso');
  };

  const handleCreatePatient = async (patientData: any) => {
    try {
      await gatewayClient.post('/patients', patientData);
      showSuccess('Paciente cadastrado com sucesso');
      setShowPatientForm(false);
    } catch (err) {
      showError('Erro ao cadastrar paciente');
    }
  };

  const getCategoryOptions = () => {
    switch (activeTab) {
      case 'refeicoes':
        return ['Cafe da manha', 'Lanche da manha', 'Almoco', 'Lanche da tarde', 'Jantar', 'Ceia', 'Pre-treino', 'Pos-treino'];
      case 'treinos':
        return ['Peito', 'Costas', 'Ombros', 'Biceps', 'Triceps', 'Pernas', 'Gluteos', 'Abdomen', 'Cardio', 'Funcional'];
      case 'suplementos':
        return ['Proteina', 'Aminoacido', 'Vitamina', 'Mineral', 'Performance', 'Saude', 'Recuperacao'];
      case 'fitoterapicos':
        return ['Adaptogeno', 'Calmante', 'Anti-inflamatorio', 'Digestivo', 'Imunidade', 'Hormonal', 'Cognitivo'];
      default:
        return [];
    }
  };

  const getTabTitle = () => {
    switch (activeTab) {
      case 'pacientes': return 'Pacientes';
      case 'refeicoes': return 'Refeicoes';
      case 'treinos': return 'Exercicios';
      case 'suplementos': return 'Suplementos';
      case 'fitoterapicos': return 'Fitoterapicos';
    }
  };

  const getTabSubtitle = () => {
    switch (activeTab) {
      case 'pacientes': return 'Gerencie seus pacientes cadastrados';
      case 'refeicoes': return 'Cadastre refeicoes para usar nos planos alimentares';
      case 'treinos': return 'Cadastre exercicios para montar protocolos de treino';
      case 'suplementos': return 'Cadastre suplementos para protocolos de suplementacao';
      case 'fitoterapicos': return 'Cadastre fitoterapicos para protocolos naturais';
    }
  };

  const renderCardContent = (item: CadastroItem) => {
    if (activeTab === 'refeicoes') {
      return (
        <div className="cadastro-card-info">
          {item.calorias && <span className="cadastro-card-tag highlight"><Flame size={12} /> {item.calorias} kcal</span>}
          {item.proteinas && <span className="cadastro-card-tag">P: {item.proteinas}g</span>}
          {item.carboidratos && <span className="cadastro-card-tag">C: {item.carboidratos}g</span>}
          {item.gorduras && <span className="cadastro-card-tag">G: {item.gorduras}g</span>}
          {item.tempo_preparo && <span className="cadastro-card-tag"><Clock size={12} /> {item.tempo_preparo}</span>}
        </div>
      );
    }
    if (activeTab === 'treinos') {
      return (
        <div className="cadastro-card-info">
          {item.grupo_muscular && <span className="cadastro-card-tag highlight"><Dumbbell size={12} /> {item.grupo_muscular}</span>}
          {item.series && <span className="cadastro-card-tag">{item.series} series</span>}
          {item.repeticoes && <span className="cadastro-card-tag">{item.repeticoes} reps</span>}
          {item.descanso && <span className="cadastro-card-tag"><Clock size={12} /> {item.descanso}</span>}
          {item.equipamento && <span className="cadastro-card-tag">{item.equipamento}</span>}
        </div>
      );
    }
    if (activeTab === 'suplementos' || activeTab === 'fitoterapicos') {
      return (
        <div className="cadastro-card-info">
          {item.dosagem && <span className="cadastro-card-tag highlight"><Pill size={12} /> {item.dosagem}</span>}
          {item.horario && <span className="cadastro-card-tag"><Clock size={12} /> {item.horario}</span>}
          {item.objetivo && <span className="cadastro-card-tag">{item.objetivo}</span>}
        </div>
      );
    }
    return null;
  };

  const renderFormFields = () => {
    if (activeTab === 'refeicoes') {
      return (
        <>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Calorias (kcal)</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 420"
                value={formData.calorias} onChange={e => setFormData(p => ({ ...p, calorias: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Tempo de preparo</label>
              <input className="cadastro-form-input" placeholder="Ex: 30 min"
                value={formData.tempo_preparo} onChange={e => setFormData(p => ({ ...p, tempo_preparo: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Proteinas (g)</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 45"
                value={formData.proteinas} onChange={e => setFormData(p => ({ ...p, proteinas: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Carboidratos (g)</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 35"
                value={formData.carboidratos} onChange={e => setFormData(p => ({ ...p, carboidratos: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Gorduras (g)</label>
            <input type="number" className="cadastro-form-input" placeholder="Ex: 10"
              value={formData.gorduras} onChange={e => setFormData(p => ({ ...p, gorduras: e.target.value }))} />
          </div>
        </>
      );
    }
    if (activeTab === 'treinos') {
      return (
        <>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Grupo muscular</label>
              <input className="cadastro-form-input" placeholder="Ex: Peitoral"
                value={formData.grupo_muscular} onChange={e => setFormData(p => ({ ...p, grupo_muscular: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Equipamento</label>
              <input className="cadastro-form-input" placeholder="Ex: Halter, Barra"
                value={formData.equipamento} onChange={e => setFormData(p => ({ ...p, equipamento: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-row">
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Series</label>
              <input type="number" className="cadastro-form-input" placeholder="Ex: 4"
                value={formData.series} onChange={e => setFormData(p => ({ ...p, series: e.target.value }))} />
            </div>
            <div className="cadastro-form-group">
              <label className="cadastro-form-label">Repeticoes</label>
              <input className="cadastro-form-input" placeholder="Ex: 8-12"
                value={formData.repeticoes} onChange={e => setFormData(p => ({ ...p, repeticoes: e.target.value }))} />
            </div>
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Descanso</label>
            <input className="cadastro-form-input" placeholder="Ex: 90s"
              value={formData.descanso} onChange={e => setFormData(p => ({ ...p, descanso: e.target.value }))} />
          </div>
        </>
      );
    }
    if (activeTab === 'suplementos' || activeTab === 'fitoterapicos') {
      return (
        <>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Dosagem</label>
            <input className="cadastro-form-input" placeholder="Ex: 5g/dia, 600mg 2x ao dia"
              value={formData.dosagem} onChange={e => setFormData(p => ({ ...p, dosagem: e.target.value }))} />
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Horario</label>
            <input className="cadastro-form-input" placeholder="Ex: Pos-treino, 08:00 com alimento"
              value={formData.horario} onChange={e => setFormData(p => ({ ...p, horario: e.target.value }))} />
          </div>
          <div className="cadastro-form-group">
            <label className="cadastro-form-label">Objetivo</label>
            <textarea className="cadastro-form-textarea" placeholder="Descreva o objetivo deste item..."
              value={formData.objetivo} onChange={e => setFormData(p => ({ ...p, objetivo: e.target.value }))} />
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="cadastro-page">
      <div className="cadastro-container">
        {/* Header */}
        <div className="cadastro-header">
          <div className="cadastro-header-content">
            <div>
              <h1 className="cadastro-title">Cadastro</h1>
              <p className="cadastro-subtitle">Gerencie seus cadastros de pacientes, refeicoes, treinos, suplementos e fitoterapicos.</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="cadastro-tabs">
          {TABS.filter(tab => !tab.adminOnly || isClinicAdmin).map(tab => {
            const Icon = tab.icon;
            const count = tab.key === 'pacientes' || tab.key === 'clinica' ? 0 : (data[tab.key]?.length || 0);
            return (
              <button
                key={tab.key}
                className={`cadastro-tab ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => { setActiveTab(tab.key); setSearch(''); setShowFavoritesOnly(false); }}
              >
                <Icon size={18} />
                {tab.label}
                {count > 0 && <span className="cadastro-tab-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Clinica Tab */}
        {activeTab === 'clinica' ? (
          <ClinicManagementPage />
        ) : activeTab === 'pacientes' ? (
          <div>
            {showPatientForm ? (
              <div style={{ background: '#ffffff', borderRadius: '16px', border: '1.5px solid #E2E8F0', overflow: 'hidden' }}>
                <PatientForm
                  onSubmit={handleCreatePatient}
                  onCancel={() => setShowPatientForm(false)}
                  title="Novo Paciente"
                />
              </div>
            ) : (
              <>
                <div className="cadastro-section-header">
                  <div>
                    <h2 className="cadastro-section-title">Pacientes</h2>
                    <p className="cadastro-section-subtitle">Cadastre novos pacientes diretamente por aqui</p>
                  </div>
                  <button className="cadastro-btn-add" onClick={() => setShowPatientForm(true)}>
                    <Plus size={18} />
                    Novo Paciente
                  </button>
                </div>
                <div className="cadastro-empty">
                  <div className="cadastro-empty-icon">
                    <UserPlus size={28} />
                  </div>
                  <h3 className="cadastro-empty-title">Cadastre seus pacientes</h3>
                  <p className="cadastro-empty-text">Clique no botao acima para cadastrar um novo paciente.</p>
                  <button className="cadastro-empty-btn" onClick={() => setShowPatientForm(true)}>
                    <Plus size={16} />
                    Novo Paciente
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {/* Section Header */}
            <div className="cadastro-section-header">
              <div>
                <h2 className="cadastro-section-title">{getTabTitle()}</h2>
                <p className="cadastro-section-subtitle">{getTabSubtitle()}</p>
              </div>
              <button className="cadastro-btn-add" onClick={openAddModal}>
                <Plus size={18} />
                Novo {getTabTitle()?.slice(0, -1)}
              </button>
            </div>

            {/* Filters */}
            <div className="cadastro-filters">
              <div className="cadastro-search">
                <Search />
                <input
                  placeholder={`Buscar ${getTabTitle()?.toLowerCase()}...`}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <button
                className={`cadastro-filter-btn ${showFavoritesOnly ? 'active' : ''}`}
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              >
                <Star size={16} />
                Favoritos
              </button>
            </div>

            {/* Grid */}
            {filteredItems.length > 0 ? (
              <div className="cadastro-grid">
                {filteredItems.map(item => (
                  <div key={item.id} className="cadastro-card">
                    <div className="cadastro-card-header">
                      <div>
                        <h3 className="cadastro-card-title">{item.nome}</h3>
                        <span className="cadastro-card-category">{item.categoria}</span>
                      </div>
                      <div className="cadastro-card-actions">
                        <button
                          className={`cadastro-card-btn ${item.favorito ? 'favorite' : ''}`}
                          onClick={() => toggleFavorite(item.id)}
                          title={item.favorito ? 'Remover favorito' : 'Adicionar favorito'}
                        >
                          <Star size={16} fill={item.favorito ? 'currentColor' : 'none'} />
                        </button>
                        <button className="cadastro-card-btn" onClick={() => openEditModal(item)} title="Editar">
                          <Pencil size={16} />
                        </button>
                        <button className="cadastro-card-btn" onClick={() => deleteItem(item.id)} title="Excluir">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="cadastro-card-body">
                      {renderCardContent(item)}
                      <p className="cadastro-card-description">{item.descricao}</p>
                    </div>
                    <div className="cadastro-card-footer">
                      <span className="cadastro-card-date">Criado em {item.created_at}</span>
                      {item.favorito && (
                        <span className="cadastro-card-badge-fav">
                          <Star size={12} fill="currentColor" /> Favorito
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="cadastro-empty">
                <div className="cadastro-empty-icon">
                  {activeTab === 'refeicoes' && <UtensilsCrossed size={28} />}
                  {activeTab === 'treinos' && <Dumbbell size={28} />}
                  {activeTab === 'suplementos' && <Pill size={28} />}
                  {activeTab === 'fitoterapicos' && <Leaf size={28} />}
                </div>
                <h3 className="cadastro-empty-title">
                  {search ? 'Nenhum resultado encontrado' : `Nenhum cadastro de ${getTabTitle()?.toLowerCase()}`}
                </h3>
                <p className="cadastro-empty-text">
                  {search
                    ? 'Tente buscar com outros termos.'
                    : `Comece cadastrando ${activeTab === 'refeicoes' ? 'suas refeicoes' : activeTab === 'treinos' ? 'seus exercicios' : activeTab === 'suplementos' ? 'seus suplementos' : 'seus fitoterapicos'}.`
                  }
                </p>
                {!search && (
                  <button className="cadastro-empty-btn" onClick={openAddModal}>
                    <Plus size={16} />
                    Cadastrar primeiro item
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="cadastro-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="cadastro-modal">
            <div className="cadastro-modal-header">
              <h3 className="cadastro-modal-title">
                {editingItem ? `Editar ${getTabTitle()?.slice(0, -1)}` : `Novo ${getTabTitle()?.slice(0, -1)}`}
              </h3>
              <button className="cadastro-modal-close" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="cadastro-modal-body">
              <div className="cadastro-form-group">
                <label className="cadastro-form-label">Nome *</label>
                <input className="cadastro-form-input" placeholder="Nome do item"
                  value={formData.nome} onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} />
              </div>
              <div className="cadastro-form-group">
                <label className="cadastro-form-label">Categoria</label>
                <select className="cadastro-form-select"
                  value={formData.categoria} onChange={e => setFormData(p => ({ ...p, categoria: e.target.value }))}>
                  <option value="">Selecione uma categoria</option>
                  {getCategoryOptions().map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
              <div className="cadastro-form-group">
                <label className="cadastro-form-label">Descricao</label>
                <textarea className="cadastro-form-textarea" placeholder="Descreva o item..."
                  value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))} />
              </div>

              {renderFormFields()}

              <div className="cadastro-form-group">
                <div
                  className={`cadastro-form-toggle ${formData.favorito ? 'active' : ''}`}
                  onClick={() => setFormData(p => ({ ...p, favorito: !p.favorito }))}
                >
                  <Star size={20} className="cadastro-form-toggle-star" fill={formData.favorito ? 'currentColor' : 'none'} />
                  <div>
                    <div className="cadastro-form-toggle-text">Marcar como favorito</div>
                    <div className="cadastro-form-toggle-hint">Itens favoritos aparecem em destaque nos protocolos</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="cadastro-modal-footer">
              <button className="cadastro-btn-cancel" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="cadastro-btn-save" onClick={handleSave}>
                {editingItem ? 'Salvar alteracoes' : 'Cadastrar'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
