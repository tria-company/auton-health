'use client';

import React, { useState, useEffect } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { supabase } from '@/lib/supabase';
import { FileText, Loader2, Search, MoreHorizontal, Plus, FileCheck } from 'lucide-react';
import { UploadedFile } from './FileUpload';
import { ExamUploadModal } from './modals/ExamUploadModal';

interface Exame {
  id: string;
  nome: string;
  dataAnexo: string;
  tipo: string;
  url: string;
  fileName: string;
}

interface ExamesUploadSectionProps {
  consultaId: string;
  consultaStatus?: string;
  consultaEtapa?: string;
  patientId?: string;
  disabled?: boolean;
}

export default function ExamesUploadSection({
  consultaId,
  consultaStatus,
  consultaEtapa,
  patientId,
  disabled = false
}: ExamesUploadSectionProps) {
  const [exames, setExames] = useState<Exame[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const itemsPerPage = 10;

  const fetchExames = async () => {
    try {
      setLoading(true);
      const response = await gatewayClient.get(`/exames/${consultaId}`);
      if (!response.success) {
        console.error('Erro ao buscar exames:', response.status, response.error);
        throw new Error(response.error || 'Erro ao buscar exames');
      }
      setExames((response as any).exames || []);
    } catch (error) {
      console.error('Erro ao buscar exames:', error);
      setExames([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (consultaId) {
      fetchExames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId]);

  const handleUploadExam = async (files: UploadedFile[]) => {
    // 1. Upload de cada arquivo para o Supabase Storage
    const folderPath = `exames/${patientId || consultaId}`;
    const uploadedUrls: string[] = [];

    for (const fileObj of files) {
      const file = fileObj.file;
      const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const fileName = `${Date.now()}_${sanitizedName}`;
      const filePath = `${folderPath}/${fileName}`;

      const { error } = await supabase.storage
        .from('documents')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new Error(`Falha ao enviar ${file.name}: ${error.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);

      if (publicUrlData.publicUrl) {
        uploadedUrls.push(publicUrlData.publicUrl);
      }
    }

    // 2. Vincular URLs à consulta via gateway
    const linkResponse = await gatewayClient.post(`/exames/${consultaId}/link`, { fileUrls: uploadedUrls });

    if (!linkResponse.success) {
      throw new Error(linkResponse.error || 'Erro ao vincular exames à consulta');
    }

    // 3. Atualizar lista
    fetchExames();
  };

  // Filtrar exames por termo de busca
  const filteredExames = exames.filter(exame =>
    exame.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exame.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular paginacao
  const totalPages = Math.ceil(filteredExames.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExames = filteredExames.slice(startIndex, startIndex + itemsPerPage);

  const handleDownload = (url: string, fileName: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="exames-section-container">
      {/* Header */}
      <div className="exames-section-header">
        <div className="exames-tab-header">
          <div className="exames-tab-active">Exames</div>
        </div>

        <div className="exames-header-actions">
          <button
            className="exames-anexar-button"
            onClick={() => setShowUploadModal(true)}
            disabled={disabled}
          >
            <Plus size={18} />
            <span>Anexar Exame</span>
            <FileCheck size={18} />
          </button>

          <div className="exames-search-container">
            <Search size={19} className="exames-search-icon" />
            <input
              type="text"
              placeholder="Buscar"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="exames-search-input"
            />
          </div>
        </div>
      </div>

      {/* Lista de exames */}
      <div className="exames-list-container">
        {loading ? (
          <div className="exames-loading">
            <Loader2 className="animate-spin" size={24} />
            <span>Carregando exames...</span>
          </div>
        ) : paginatedExames.length === 0 ? (
          <div className="exames-empty">
            <FileText size={48} />
            <p>Nenhum exame encontrado</p>
            {searchTerm && <p className="exames-empty-hint">Tente buscar com outros termos</p>}
          </div>
        ) : (
          <>
            <div className="exames-table-header">
              <div className="exames-table-header-content">
                <div className="exames-table-col-nome">Nome do Exame</div>
                <div className="exames-table-divider"></div>
                <div className="exames-table-col-data">Data de anexo</div>
                <div className="exames-table-divider"></div>
                <div className="exames-table-col-tipo">Tipo</div>
                <div className="exames-table-divider"></div>
                <div className="exames-table-col-acoes"></div>
              </div>
            </div>

            {paginatedExames.map((exame) => (
              <div key={exame.id} className="exames-table-row">
                <div className="exames-table-row-content">
                  <div className="exames-table-icon">
                    <FileText size={45} />
                  </div>
                  <div className="exames-table-col-nome">{exame.nome}</div>
                  <div className="exames-table-divider"></div>
                  <div className="exames-table-col-data">{exame.dataAnexo}</div>
                  <div className="exames-table-divider"></div>
                  <div className="exames-table-col-tipo">{exame.tipo}</div>
                  <div className="exames-table-divider"></div>
                  <div className="exames-table-col-acoes">
                    <button
                      className="exames-action-menu"
                      onClick={() => handleDownload(exame.url, exame.fileName)}
                      title="Ver opcoes"
                    >
                      <MoreHorizontal size={24} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Paginacao */}
      {totalPages > 1 && (
        <div className="exames-pagination">
          <button
            className="exames-pagination-button"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            ←
          </button>

          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }

            return (
              <button
                key={pageNum}
                className={`exames-pagination-page ${currentPage === pageNum ? 'active' : ''}`}
                onClick={() => setCurrentPage(pageNum)}
              >
                {pageNum}
              </button>
            );
          })}

          {totalPages > 5 && currentPage < totalPages - 2 && (
            <>
              <span className="exames-pagination-ellipsis">...</span>
              <button
                className="exames-pagination-page"
                onClick={() => setCurrentPage(totalPages)}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            className="exames-pagination-button"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
          >
            →
          </button>
        </div>
      )}

      {/* Modal de upload - mesmo usado durante a consulta */}
      <ExamUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUploadExam}
      />
    </div>
  );
}
