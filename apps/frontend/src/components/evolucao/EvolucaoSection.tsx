'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ChevronDown, Camera, Pencil, X, Scale, Ruler, Target,
  TrendingDown, Activity, FileText, Loader2
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Area, AreaChart
} from 'recharts';
import { createBrowserClient } from '@supabase/ssr';
import './evolucao.css';

// Types
interface EvolucaoData {
  id: string;
  consulta_id: string;
  paciente_id: string;
  num: number;
  mes: string;
  mes_abr: string;
  ano: string;
  data: string;
  peso: number;
  cintura: number;
  imc: number;
  gordura: number;
  massa_magra: number;
  delta_peso?: string;
  delta_cintura?: string;
  delta_gordura?: string;
  delta_magra?: string;
  imc_class: string;
  progresso: number;
  total_perdido: number;
  is_goal: boolean;
  nota?: string;
  peso_meta?: number;
  imc_meta?: number;
  fotos?: {
    frente?: string;
    costas?: string;
    lateral_esq?: string;
    lateral_dir?: string;
  };
}

interface EvolucaoSectionProps {
  consultaId: string;
  patientId?: string;
  patientName?: string;
}

const PHOTO_LABELS = ['Frente fechada', 'Costas fechadas', 'Lateral esq. bracos cruzados', 'Lateral dir. bracos cruzados'];
const PHOTO_KEYS = ['frente', 'costas', 'lateral_esq', 'lateral_dir'] as const;

function getSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

function imcPct(imc: number) {
  return Math.min(Math.max((imc - 18.5) / (35 - 18.5) * 100, 2), 94);
}

function gordOffset(g: number) {
  return 125.7 * (1 - g / 60);
}

function muscOffset(m: number) {
  return Math.max(125.7 * (1 - (m - 38) / 10), 8);
}

// Demo data for when no real data exists
function getDemoData(): EvolucaoData[] {
  return [
    {
      id: 'demo-1', consulta_id: '', paciente_id: '', num: 1,
      mes: 'Janeiro', mes_abr: 'Jan', ano: '2025', data: '10 Jan 2025',
      peso: 75.0, cintura: 80, imc: 29.3, gordura: 37, massa_magra: 41.3,
      imc_class: 'Obesidade I', progresso: 0, total_perdido: 0, is_goal: false,
      peso_meta: 65, imc_meta: 25.4,
      nota: 'Inicio do acompanhamento. Habitos alimentares irregulares, alto consumo de ultraprocessados. Paciente motivado e comprometido.'
    },
    {
      id: 'demo-2', consulta_id: '', paciente_id: '', num: 2,
      mes: 'Fevereiro', mes_abr: 'Fev', ano: '2025', data: '12 Fev 2025',
      peso: 73.2, cintura: 78, imc: 28.6, gordura: 35, massa_magra: 41.5,
      delta_peso: '-1,8 kg', delta_cintura: '-2 cm', delta_gordura: '-2pp', delta_magra: '+0,2 kg',
      imc_class: 'Sobrepeso', progresso: 18, total_perdido: 1.8, is_goal: false,
      peso_meta: 65, imc_meta: 25.4,
      nota: 'Otima adaptacao. Reduziu acucar e farinhas refinadas. Sono melhorou. Manteve 3x treino por semana.'
    },
    {
      id: 'demo-3', consulta_id: '', paciente_id: '', num: 3,
      mes: 'Marco', mes_abr: 'Mar', ano: '2025', data: '10 Mar 2025',
      peso: 71.0, cintura: 76, imc: 27.7, gordura: 33, massa_magra: 41.8,
      delta_peso: '-2,2 kg', delta_cintura: '-2 cm', delta_gordura: '-2pp', delta_magra: '+0,3 kg',
      imc_class: 'Sobrepeso', progresso: 40, total_perdido: 4.0, is_goal: false,
      peso_meta: 65, imc_meta: 25.4,
      nota: 'Excelente progresso! Aumentamos proteina no jantar. Paciente relatou mais energia e menos inchaco abdominal.'
    },
    {
      id: 'demo-4', consulta_id: '', paciente_id: '', num: 4,
      mes: 'Abril', mes_abr: 'Abr', ano: '2025', data: '08 Abr 2025',
      peso: 68.5, cintura: 73, imc: 26.8, gordura: 30, massa_magra: 42.1,
      delta_peso: '-2,5 kg', delta_cintura: '-3 cm', delta_gordura: '-3pp', delta_magra: '+0,3 kg',
      imc_class: 'Sobrepeso', progresso: 65, total_perdido: 6.5, is_goal: false,
      peso_meta: 65, imc_meta: 25.4,
      nota: 'Marco importante: -6,5 kg! IMC proximo de normal. Introduzimos carboidratos ciclados no dia de treino.'
    },
    {
      id: 'demo-5', consulta_id: '', paciente_id: '', num: 5,
      mes: 'Junho', mes_abr: 'Jun', ano: '2025', data: '09 Jun 2025',
      peso: 65.0, cintura: 69, imc: 25.4, gordura: 26, massa_magra: 42.6,
      delta_peso: '-3,5 kg', delta_cintura: '-4 cm', delta_gordura: '-4pp', delta_magra: '+0,5 kg',
      imc_class: 'Normal', progresso: 100, total_perdido: 10.0, is_goal: true,
      peso_meta: 65, imc_meta: 25.4,
      nota: 'META ATINGIDA! Peso: 65 kg. Plano de manutencao iniciado. Paciente firme e confiante. Resultado extraordinario!'
    }
  ];
}

export default function EvolucaoSection({ consultaId, patientId, patientName }: EvolucaoSectionProps) {
  const [data, setData] = useState<EvolucaoData[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null);

  useEffect(() => {
    // For now, use demo data. Replace with API call when backend is ready.
    const demoData = getDemoData();
    setData(demoData);
    setLoading(false);
  }, [consultaId, patientId]);

  // Chart data
  const chartData = data.map(d => ({
    name: d.mes_abr,
    peso: d.peso,
    cintura: d.cintura,
  }));

  const toggle = (id: string) => {
    setOpenId(prev => prev === id ? null : id);
  };

  const handlePhotoUpload = async (evolucaoId: string, slotIndex: number, file: File) => {
    if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) return;

    const key = `${evolucaoId}-${slotIndex}`;
    setUploadingPhoto(key);

    try {
      const supabase = getSupabase();
      const ext = file.name.split('.').pop();
      const fileName = `evo_${PHOTO_KEYS[slotIndex]}_${Date.now()}.${ext}`;
      const filePath = `evolucao/${patientId}/${fileName}`;

      const { error } = await supabase.storage.from('documents').upload(filePath, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);

      setData(prev => prev.map(d => {
        if (d.id !== evolucaoId) return d;
        const fotos = { ...d.fotos };
        (fotos as any)[PHOTO_KEYS[slotIndex]] = urlData.publicUrl;
        return { ...d, fotos };
      }));
    } catch (err) {
      console.error('Erro no upload:', err);
    } finally {
      setUploadingPhoto(null);
    }
  };

  const removePhoto = (evolucaoId: string, slotIndex: number) => {
    setData(prev => prev.map(d => {
      if (d.id !== evolucaoId) return d;
      const fotos = { ...d.fotos };
      (fotos as any)[PHOTO_KEYS[slotIndex]] = undefined;
      return { ...d, fotos };
    }));
  };

  if (loading) {
    return (
      <div className="evo-empty">
        <Loader2 size={32} style={{ animation: 'spin 0.8s linear infinite' }} />
        <p style={{ marginTop: 12, color: '#64748B' }}>Carregando evolucao...</p>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="evo-empty">
        <div className="evo-empty-icon"><Activity size={28} /></div>
        <h3>Nenhuma evolucao registrada</h3>
        <p>As evolucoes mensais serao exibidas aqui conforme as consultas forem realizadas.</p>
      </div>
    );
  }

  const pesoMeta = data[0]?.peso_meta || 65;
  const imcMeta = data[0]?.imc_meta || 25.4;

  return (
    <div className="evo-container">
      {/* Global Charts */}
      <div className="evo-charts-row">
        <div className="evo-chart-card">
          <div className="evo-chart-title">Peso corporal</div>
          <div className="evo-chart-sub">kg - evolucao mes a mes</div>
          <div className="evo-chart-wrap">
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradPeso" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1A3D61" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#1A3D61" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={pesoMeta} stroke="#1A3D6144" strokeDasharray="5 4" strokeWidth={1.5} />
                <Area type="monotone" dataKey="peso" stroke="#1A3D61" strokeWidth={2.5} fill="url(#gradPeso)" dot={{ r: 4, fill: '#fff', stroke: '#1A3D61', strokeWidth: 2.5 }} activeDot={{ r: 7 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="evo-chart-card">
          <div className="evo-chart-title">Circunferencia da cintura</div>
          <div className="evo-chart-sub">cm - evolucao mes a mes</div>
          <div className="evo-chart-wrap">
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="gradCintura" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#153350" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#153350" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.04)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={68} stroke="#15335044" strokeDasharray="5 4" strokeWidth={1.5} />
                <Area type="monotone" dataKey="cintura" stroke="#153350" strokeWidth={2.5} fill="url(#gradCintura)" dot={{ r: 4, fill: '#fff', stroke: '#153350', strokeWidth: 2.5 }} activeDot={{ r: 7 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="evo-timeline">
        {data.map((a) => {
          const isOpen = openId === a.id;
          const photoUrl = (slot: number) => a.fotos?.[PHOTO_KEYS[slot] as keyof typeof a.fotos];

          return (
            <div key={a.id} className={`evo-item ${isOpen ? 'open' : ''} ${a.is_goal ? 'goal' : ''}`}>
              {/* Head */}
              <div className="evo-head" onClick={() => toggle(a.id)}>
                <div className="evo-num">
                  <div className="evo-num-n">{a.num}</div>
                  <div className="evo-num-label">Ana.</div>
                </div>
                <div className="evo-info">
                  <div className="evo-info-top">
                    <span className="evo-month">{a.mes} {a.ano}</span>
                    <span className="evo-date">{a.data}</span>
                    {a.is_goal && <span className="evo-goal-badge">Meta atingida</span>}
                  </div>
                  <div className="evo-pills">
                    {a.delta_peso ? (
                      <>
                        <span className="evo-pill evo-pill-primary">{a.delta_peso}</span>
                        <span className="evo-pill evo-pill-primary">{a.delta_cintura}</span>
                        <span className="evo-pill evo-pill-warn">IMC {a.imc.toFixed(1)} - {a.imc_class}</span>
                      </>
                    ) : (
                      <>
                        <span className="evo-pill">Peso inicial: {a.peso} kg</span>
                        <span className="evo-pill">IMC {a.imc.toFixed(1)} - {a.imc_class}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="evo-chevron">
                  <ChevronDown size={14} />
                </div>
              </div>

              {/* Body */}
              <div className="evo-body">
                <div className="evo-body-inner">
                  <div className="evo-bottom-row">
                    {/* Photos Grid */}
                    <div className="evo-photos-grid">
                      {PHOTO_LABELS.map((label, i) => {
                        const url = photoUrl(i);
                        const uploadKey = `${a.id}-${i}`;
                        const isUploading = uploadingPhoto === uploadKey;

                        return (
                          <div key={i} className="evo-photo-slot">
                            {isUploading ? (
                              <div className="evo-slot-empty">
                                <Loader2 size={24} style={{ color: '#1A3D61', animation: 'spin 0.8s linear infinite' }} />
                                <span className="evo-slot-lbl">Enviando...</span>
                              </div>
                            ) : url ? (
                              <>
                                <img className="evo-slot-img" src={url} alt={label} />
                                <div className="evo-slot-footer">
                                  <div className="evo-slot-pos">{label}</div>
                                  <div className="evo-slot-date">{a.mes_abr} {a.ano}</div>
                                </div>
                                <button
                                  className="evo-slot-remove"
                                  onClick={(e) => { e.stopPropagation(); removePhoto(a.id, i); }}
                                >
                                  <X size={12} />
                                </button>
                              </>
                            ) : (
                              <label className="evo-slot-empty" style={{ cursor: 'pointer' }}>
                                <div className="evo-slot-icon"><Camera size={16} /></div>
                                <div className="evo-slot-lbl">{label}</div>
                                <input
                                  type="file"
                                  accept="image/*"
                                  style={{ display: 'none' }}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePhotoUpload(a.id, i, file);
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Info Card */}
                    <div className="evo-info-card">
                      <div className="evo-info-tag">{a.mes_abr} {a.ano}</div>

                      <div className="evo-info-row">
                        <span className="evo-info-key"><Scale size={12} /> Peso</span>
                        <span className="evo-info-val">
                          {a.peso.toFixed(1)} kg
                          {a.delta_peso && <span className="evo-delta evo-d-pos">{a.delta_peso}</span>}
                        </span>
                      </div>

                      <div className="evo-info-row">
                        <span className="evo-info-key"><Ruler size={12} /> Cintura</span>
                        <span className="evo-info-val">
                          {a.cintura} cm
                          {a.delta_cintura && <span className="evo-delta evo-d-pos">{a.delta_cintura}</span>}
                        </span>
                      </div>

                      <div className="evo-info-div" />

                      {/* IMC */}
                      <div className="evo-imc-row">
                        <div className="evo-imc-item">
                          <div className="evo-imc-lbl">IMC atual</div>
                          <div className="evo-imc-val">{a.imc.toFixed(1)}</div>
                          <div className="evo-imc-cls" style={{ color: a.is_goal ? '#1A3D61' : '#D4A017' }}>{a.imc_class}</div>
                        </div>
                        <div className="evo-imc-arrow">
                          <TrendingDown size={14} />
                        </div>
                        <div className="evo-imc-item">
                          <div className="evo-imc-lbl">IMC meta</div>
                          <div className="evo-imc-val evo-imc-val-goal">{imcMeta.toFixed(1)}</div>
                          <div className="evo-imc-cls" style={{ color: '#1A3D61' }}>Normal</div>
                        </div>
                      </div>

                      <div className="evo-imc-track">
                        <div className="evo-imc-marker" style={{ left: `${imcPct(a.imc)}%` }} />
                      </div>
                      <div className="evo-imc-scale">
                        <span>18,5</span><span>25</span><span>30</span>
                      </div>

                      <div className="evo-info-div" />

                      {/* Composicao corporal */}
                      <div className="evo-comp-lbl">Composicao Corporal</div>
                      <div className="evo-comp-row">
                        <div className="evo-comp-item">
                          <div className="evo-comp-ring-wrap">
                            <svg viewBox="0 0 52 52" width="52" height="52">
                              <circle cx="26" cy="26" r="20" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                              <circle cx="26" cy="26" r="20" fill="none" stroke="#1A3D61" strokeWidth="5"
                                strokeDasharray="125.7" strokeDashoffset={gordOffset(a.gordura)}
                                strokeLinecap="round" transform="rotate(-90 26 26)"
                                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                            </svg>
                            <div className="evo-comp-center"><div className="evo-comp-val">{a.gordura}%</div></div>
                          </div>
                          <div className="evo-comp-name">% Gordura</div>
                          {a.delta_gordura && <span className="evo-delta evo-d-pos" style={{ fontSize: 9 }}>{a.delta_gordura}</span>}
                        </div>
                        <div className="evo-comp-item">
                          <div className="evo-comp-ring-wrap">
                            <svg viewBox="0 0 52 52" width="52" height="52">
                              <circle cx="26" cy="26" r="20" fill="none" stroke="#E2E8F0" strokeWidth="5" />
                              <circle cx="26" cy="26" r="20" fill="none" stroke="#153350" strokeWidth="5"
                                strokeDasharray="125.7" strokeDashoffset={muscOffset(a.massa_magra)}
                                strokeLinecap="round" transform="rotate(-90 26 26)"
                                style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
                            </svg>
                            <div className="evo-comp-center">
                              <div className="evo-comp-val" style={{ fontSize: 10 }}>{a.massa_magra.toFixed(1)}<span style={{ fontSize: 8 }}>kg</span></div>
                            </div>
                          </div>
                          <div className="evo-comp-name">Massa magra</div>
                          {a.delta_magra && <span className="evo-delta evo-d-pos" style={{ fontSize: 9 }}>{a.delta_magra}</span>}
                        </div>
                      </div>

                      <div className="evo-info-div" />

                      {/* Progresso */}
                      <div className="evo-prog-lbl">Progresso rumo a meta ({pesoMeta} kg)</div>
                      <div className="evo-prog-track">
                        <div className="evo-prog-fill" style={{ width: isOpen ? `${a.progresso}%` : '0%' }} />
                      </div>
                      <div className="evo-prog-nums">
                        <span>{data[0]?.peso} kg</span>
                        <span className="evo-prog-pct">{a.progresso}%</span>
                        <span>{pesoMeta} kg</span>
                      </div>

                      {/* Total */}
                      <div className="evo-total-badge">
                        <div className="evo-total-val">
                          {a.total_perdido > 0 ? `-${a.total_perdido.toFixed(1)} kg` : `${a.peso.toFixed(1)} kg`}
                        </div>
                        <div className="evo-total-lbl">
                          {a.total_perdido > 0 ? 'perdidos desde o inicio' : 'inicio do acompanhamento'}
                        </div>
                      </div>

                      {/* Nota */}
                      {a.nota && (
                        <div className="evo-nota-block">
                          <div className="evo-nota-lbl">Obs. do nutricionista</div>
                          <div className="evo-nota-txt">{a.nota}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
