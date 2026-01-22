'use client';

import React, { useState, useEffect } from 'react';
import { gatewayClient } from '@/lib/gatewayClient';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Search, MoreHorizontal, Plus, FileCheck } from 'lucide-react';
import FileUpload, { useFileUpload, UploadedFile } from './FileUpload';

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
  const { uploadedFiles, setUploadedFiles, clearFiles } = useFileUpload();
  const [exames, setExames] = useState<Exame[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  const itemsPerPage = 10;

  const fetchExames = async () => {
    try {
      setLoading(true);
      console.log('🔍 Buscando exames para consulta:', consultaId);
      const response = await gatewayClient.get(`/exames/${consultaId}`);
      if (!response.success) {
        const errorData = response(() => ({}));
        console.error('❌ Erro ao buscar exames:', response.status, errorData);
        throw new Error(errorData.error || 'Erro ao buscar exames');
      }
      const data = response;
      console.log('✅ Exames recebidos:', data);
      setExames(data.exames || []);
    } catch (error) {
      console.error('❌ Erro ao buscar exames:', error);
      setExames([]);
    } finally {
      setLoading(false);
    }
  };

  // Buscar exames ao carregar o componente
  useEffect(() => {
    if (consultaId) {
      fetchExames();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultaId]);

  const handleFilesChange = (files: UploadedFile[]) => {
    setUploadedFiles(files);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleProcessExames = async () => {
    if (uploadedFiles.length === 0) {
      setErrorMessage('Por favor, selecione pelo menos um arquivo para processar.');
      return;
    }

    setIsProcessing(true);
    setProcessingStatus('uploading');
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const formData = new FormData();
      uploadedFiles.forEach(file => {
        formData.append('files', file.file);
      });

      setProcessingStatus('processing');

      const processResponse = await fetch(`/api/processar-exames/${consultaId}`, {
        method: 'POST',
        body: formData,
      });

      if (!processResponse.ok) {
        const errorData = await processResponse.json();
        throw new Error(errorData.error || 'Erro no processamento dos exames');
      }

      const processResult = await processResponse.json();
      
      setProcessingStatus('success');
      setSuccessMessage(processResult.message || 'Exames processados com sucesso!');
      clearFiles();
      
      // Atualizar lista de exames
      setTimeout(() => {
        fetchExames();
        setShowUploadModal(false);
        setProcessingStatus('idle');
      }, 1000);

    } catch (error) {
      console.error('❌ Erro no processamento:', error);
      setProcessingStatus('error');
      setErrorMessage(error instanceof Error ? error.message : 'Erro desconhecido no processamento');
    } finally {
      setIsProcessing(false);
    }
  };

  // Filtrar exames por termo de busca
  const filteredExames = exames.filter(exame =>
    exame.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exame.tipo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular paginação
  const totalPages = Math.ceil(filteredExames.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedExames = filteredExames.slice(startIndex, startIndex + itemsPerPage);

  const handleDownload = (url: string, fileName: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="exames-section-container">
      {/* Header com título "Exames" e ações */}
      <div className="exames-section-header">
        <div className="exames-tab-header">
          <div className="exames-tab-active">Exames</div>
        </div>
        
        <div className="exames-header-actions">
          {/* Botão Anexar Exame */}
          <button
            className="exames-anexar-button"
            onClick={() => setShowUploadModal(true)}
            disabled={disabled || isProcessing}
          >
            <Plus size={18} />
            <span>Anexar Exame</span>
            <FileCheck size={18} />
          </button>

          {/* Campo de busca */}
          <div className="exames-search-container">
            <Search size={19} className="exames-search-icon" />
            <input
              type="text"
              placeholder="Buscar"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1); // Reset para primeira página ao buscar
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
            {/* Cabeçalho da tabela */}
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

            {/* Linhas da tabela */}
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
                      title="Ver opções"
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

      {/* Paginação */}
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

      {/* Modal de upload */}
      {showUploadModal && (
        <div className="exames-upload-modal-overlay" onClick={() => !isProcessing && setShowUploadModal(false)}>
          <div className="exames-upload-modal" onClick={(e) => e.stopPropagation()}>
            <div className="exames-upload-modal-header">
              <h3>Anexar Exames</h3>
              <button
                className="exames-upload-modal-close"
                onClick={() => !isProcessing && setShowUploadModal(false)}
                disabled={isProcessing}
              >
                ×
              </button>
            </div>

            <div className="exames-upload-modal-content">
              <p>Selecione os arquivos de exames para anexar à consulta.</p>
              <p className="exames-upload-modal-hint">
                <strong>Formatos aceitos:</strong> PDF, DOC, DOCX, JPG, PNG (máximo 10MB por arquivo)
              </p>

              <FileUpload
                onFilesChange={handleFilesChange}
                maxFiles={50}
                maxSizePerFile={10}
                acceptedTypes={['application/pdf', '.doc', '.docx', 'image/jpeg', 'image/png']}
                disabled={disabled || isProcessing}
              />

              {errorMessage && (
                <div className="exames-upload-alert error">
                  <AlertCircle />
                  <div>{errorMessage}</div>
                </div>
              )}

              {successMessage && (
                <div className="exames-upload-alert success">
                  <CheckCircle />
                  <div>{successMessage}</div>
                </div>
              )}
            </div>

            <div className="exames-upload-modal-footer">
              <button
                className="exames-upload-modal-cancel"
                onClick={() => {
                  if (!isProcessing) {
                    setShowUploadModal(false);
                    clearFiles();
                    setErrorMessage(null);
                    setSuccessMessage(null);
                  }
                }}
                disabled={isProcessing}
              >
                Cancelar
              </button>
              <button
                className="exames-upload-modal-submit"
                onClick={handleProcessExames}
                disabled={disabled || isProcessing || uploadedFiles.length === 0}
              >
                {processingStatus === 'uploading' && <Loader2 className="animate-spin" size={16} />}
                {processingStatus === 'processing' && <Loader2 className="animate-spin" size={16} />}
                {processingStatus === 'success' && <CheckCircle size={16} />}
                {processingStatus === 'error' && <AlertCircle size={16} />}
                {processingStatus === 'idle' && 'Anexar Exames'}
                {processingStatus === 'uploading' && 'Enviando...'}
                {processingStatus === 'processing' && 'Processando...'}
                {processingStatus === 'success' && 'Concluído'}
                {processingStatus === 'error' && 'Tentar Novamente'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
