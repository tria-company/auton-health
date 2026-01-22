'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { UserPlus, Mail, User, Edit2, Trash2, X, RotateCcw, Unlock } from 'lucide-react';
import './gestao.css';

interface Doctor {
    id: string;
    name: string;
    email: string;
    medico_deletado: boolean;
    clinica_id: string;
    user_auth: string;
}

export default function ClinicManagementPage() {
    const { session, user } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Lista de Médicos
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [loadingDoctors, setLoadingDoctors] = useState(true);
    const [currentClinicId, setCurrentClinicId] = useState<string | null>(null);

    // Modais
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);

    // Estados de Edição
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState(''); // Email geralmente não se edita tão simples no Auth, mas podemos editar o registro medico

    // Função para buscar dados iniciais (ID da clínica e lista de médicos)
    useEffect(() => {
        if (!user || currentClinicId) return;

        const fetchClinicData = async () => {
            try {
                // 1. Buscar ID da clínica do admin logado
                const { data: adminMedico, error: adminError } = await supabase
                    .from('medicos')
                    .select('id, clinica_id')
                    .eq('user_auth', user.id)
                    .single();

                if (adminError || !adminMedico) throw new Error('Erro ao buscar dados do administrador');

                setCurrentClinicId(adminMedico.clinica_id);
            } catch (err) {
                console.error('Erro inicial:', err);
            }
        };

        fetchClinicData();
    }, [user, currentClinicId]);

    // Buscar médicos quando tiver o ID da clínica
    useEffect(() => {
        if (!currentClinicId) return;
        fetchDoctors();
    }, [currentClinicId]);

    const fetchDoctors = async () => {
        setLoadingDoctors(true);
        try {
            const { data, error } = await supabase
                .from('medicos')
                .select('*')
                .eq('clinica_id', currentClinicId)
                .eq('is_doctor', true) // Apenas médicos
                .neq('user_auth', user?.id) // Excluir o próprio admin da lista
                .order('medico_deletado', { ascending: true, nullsFirst: true }) // Ativos primeiro
                .order('created_at', { ascending: false });

            if (error) throw error;
            setDoctors(data || []);
        } catch (err) {
            console.error('Erro ao buscar médicos:', err);
        } finally {
            setLoadingDoctors(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_HTTP_URL || 'http://localhost:3001';

            const response = await fetch(`${gatewayUrl}/api/clinic/registry-doctor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ name, email })
            });

            const data = await response.json();

            if (!response.success) {
                // Handle different error formats (string, array of Zod errors, or object)
                let errorMessage = 'Erro ao cadastrar médico';
                if (typeof data.error === 'string') {
                    errorMessage = data.error;
                } else if (Array.isArray(data.error)) {
                    // Zod validation errors come as an array
                    errorMessage = data.error.map((e: any) => e.message).join(', ');
                } else if (data.error?.message) {
                    errorMessage = data.error.message;
                }
                throw new Error(errorMessage);
            }

            setMessage({ type: 'success', text: `Médico ${data.doctor.name} cadastrado com sucesso! Senha: meuprimeiroacesso_123456789` });
            setName('');
            setEmail('');
            fetchDoctors(); // Atualizar lista

        } catch (error: any) {
            console.error('Erro:', error);
            // Handle network errors (Failed to fetch)
            if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                setMessage({ type: 'error', text: 'Erro de conexão com o servidor. Verifique sua internet ou tente novamente.' });
            } else {
                setMessage({ type: 'error', text: error.message || 'Erro desconhecido ao cadastrar médico' });
            }
        } finally {
            setLoading(false);
        }
    };

    // === Ações de Edição ===
    const openEditModal = (doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setEditName(doctor.name);
        setEditEmail(doctor.email);
        setShowEditModal(true);
    };

    const handleUpdateDoctor = async () => {
        if (!selectedDoctor) return;

        try {
            const { error } = await supabase
                .from('medicos')
                .update({ name: editName }) // Atualizando apenas nome por enquanto
                .eq('id', selectedDoctor.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Dados atualizados com sucesso!' });
            setShowEditModal(false);
            fetchDoctors();
        } catch (err: any) {
            console.error('Erro ao atualizar:', err);
            setMessage({ type: 'error', text: 'Erro ao atualizar médico' });
        }
    };

    // === Ações de Exclusão (Bloqueio) ===
    const openDeleteModal = (doctor: Doctor) => {
        setSelectedDoctor(doctor);
        setShowDeleteModal(true);
    };

    const handleDeleteDoctor = async () => {
        if (!selectedDoctor) return;

        try {
            const { error } = await supabase
                .from('medicos')
                .update({ medico_deletado: true })
                .eq('id', selectedDoctor.id);

            if (error) throw error;

            setMessage({ type: 'success', text: 'Acesso do médico bloqueado com sucesso!' });
            setShowDeleteModal(false);
            fetchDoctors();
        } catch (err: any) {
            console.error('Erro ao bloquear:', err);
            setMessage({ type: 'error', text: 'Erro ao bloquear médico' });
        }
    };

    // === Ação de Desbloquear ===
    const handleUnblockDoctor = async (doctor: Doctor) => {
        try {
            const { error } = await supabase
                .from('medicos')
                .update({ medico_deletado: false })
                .eq('id', doctor.id);

            if (error) throw error;

            setMessage({ type: 'success', text: `Acesso do médico ${doctor.name} liberado com sucesso!` });
            fetchDoctors();
        } catch (err: any) {
            console.error('Erro ao desbloquear:', err);
            setMessage({ type: 'error', text: 'Erro ao liberar acesso do médico' });
        }
    };

    return (
        <div className="clinica-gestao-container">
            {/* Header */}
            <div className="clinica-gestao-header">
                <h1 className="clinica-gestao-title">Gestão da Clínica - Equipe</h1>
                <p className="clinica-gestao-subtitle">Gerencie o acesso e cadastro dos seus médicos.</p>
            </div>

            <div className="clinica-gestao-grid">
                {/* Coluna da Esquerda: Cadastro */}
                <div>
                    <div className="cadastro-card">
                        <div className="cadastro-card-header">
                            <h2 className="cadastro-card-title">
                                <UserPlus size={20} />
                                Cadastrar Novo
                            </h2>
                        </div>

                        <div className="cadastro-card-body">
                            <form onSubmit={handleRegister}>
                                <div className="cadastro-form-group">
                                    <label className="cadastro-form-label">Nome Completo</label>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        className="cadastro-form-input"
                                        placeholder="Dr. João Silva"
                                        required
                                    />
                                </div>

                                <div className="cadastro-form-group">
                                    <label className="cadastro-form-label">Email Profissional</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="cadastro-form-input"
                                        placeholder="medico@clinica.com"
                                        required
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-cadastrar"
                                >
                                    {loading ? 'Cadastrando...' : 'Cadastrar Médico'}
                                </button>

                                <p className="cadastro-password-info">
                                    Senha padrão: <strong>meuprimeiroacesso_123456789</strong>
                                </p>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Coluna da Direita: Lista */}
                <div>
                    {message && (
                        <div className={`message-alert ${message.type === 'success' ? 'message-alert-success' : 'message-alert-error'}`}>
                            <span>{message.text}</span>
                            <button onClick={() => setMessage(null)} className="btn-close-message">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    <div className="lista-medicos-card">
                        <div className="lista-medicos-header">
                            <h2 className="lista-medicos-title">Médicos Cadastrados</h2>
                            <button onClick={fetchDoctors} className="btn-refresh" title="Atualizar lista">
                                <RotateCcw size={18} />
                            </button>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="lista-medicos-table">
                                <thead className="lista-medicos-thead">
                                    <tr>
                                        <th className="lista-medicos-th">Nome</th>
                                        <th className="lista-medicos-th">Email</th>
                                        <th className="lista-medicos-th">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="lista-medicos-tbody">
                                    {loadingDoctors ? (
                                        <tr>
                                            <td colSpan={3} className="lista-medicos-empty">
                                                Carregando...
                                            </td>
                                        </tr>
                                    ) : doctors.length === 0 ? (
                                        <tr>
                                            <td colSpan={3} className="lista-medicos-empty">
                                                Nenhum médico cadastrado.
                                            </td>
                                        </tr>
                                    ) : (
                                        doctors.map((doctor) => {
                                            const isBlocked = doctor.medico_deletado === true;
                                            return (
                                                <tr
                                                    key={doctor.id}
                                                    className={`lista-medicos-tr ${isBlocked ? 'lista-medicos-tr-blocked' : ''}`}
                                                >
                                                    <td className="lista-medicos-td lista-medicos-td-name">
                                                        <span className={isBlocked ? 'doctor-name-blocked' : ''}>
                                                            {doctor.name}
                                                        </span>
                                                        {isBlocked && (
                                                            <span className="badge-blocked">Bloqueado</span>
                                                        )}
                                                    </td>
                                                    <td className={`lista-medicos-td lista-medicos-td-email ${isBlocked ? 'email-blocked' : ''}`}>
                                                        {doctor.email}
                                                    </td>
                                                    <td className="lista-medicos-td lista-medicos-td-actions">
                                                        {!isBlocked && (
                                                            <button
                                                                onClick={() => openEditModal(doctor)}
                                                                className="btn-action btn-action-edit"
                                                                title="Editar"
                                                            >
                                                                <Edit2 size={18} />
                                                            </button>
                                                        )}
                                                        {isBlocked ? (
                                                            <button
                                                                onClick={() => handleUnblockDoctor(doctor)}
                                                                className="btn-action btn-action-unblock"
                                                                title="Liberar Acesso"
                                                            >
                                                                <Unlock size={18} />
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => openDeleteModal(doctor)}
                                                                className="btn-action btn-action-delete"
                                                                title="Bloquear Acesso"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Editar */}
            {showEditModal && (
                <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Editar Médico</h3>
                            <button onClick={() => setShowEditModal(false)} className="btn-close-modal">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="modal-form-group">
                                <label className="modal-form-label">Nome</label>
                                <input
                                    type="text"
                                    className="modal-form-input"
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                />
                            </div>
                            <div className="modal-form-group">
                                <label className="modal-form-label">Email</label>
                                <input
                                    type="email"
                                    className="modal-form-input"
                                    value={editEmail}
                                    disabled
                                />
                            </div>
                            <div className="modal-actions">
                                <button onClick={() => setShowEditModal(false)} className="btn-modal-secondary">
                                    Cancelar
                                </button>
                                <button onClick={handleUpdateDoctor} className="btn-modal-primary">
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Deletar (Bloquear) */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-confirm">
                            <div className="modal-confirm-icon">
                                <Trash2 size={24} />
                            </div>
                            <h3 className="modal-confirm-title">Bloquear Acesso?</h3>
                            <p className="modal-confirm-text">
                                Tem certeza que deseja bloquear o acesso de <strong>{selectedDoctor?.name}</strong>?
                                Ele não poderá mais acessar a plataforma.
                            </p>
                            <div className="modal-actions">
                                <button onClick={() => setShowDeleteModal(false)} className="btn-modal-secondary">
                                    Cancelar
                                </button>
                                <button onClick={handleDeleteDoctor} className="btn-modal-danger">
                                    Bloquear
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
