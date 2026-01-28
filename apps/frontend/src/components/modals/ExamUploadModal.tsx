'use client';

import React, { useState } from 'react';
import { X, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import FileUpload, { useFileUpload, UploadedFile } from '../FileUpload';
import './ExamUploadModal.css';

interface ExamUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (files: UploadedFile[]) => Promise<void>;
}

export function ExamUploadModal({ isOpen, onClose, onUpload }: ExamUploadModalProps) {
    const { uploadedFiles, setUploadedFiles, clearFiles } = useFileUpload();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFilesChange = (files: UploadedFile[]) => {
        setUploadedFiles(files);
        setErrorMessage(null);
        setSuccessMessage(null);
    };

    const handleSubmit = async () => {
        if (uploadedFiles.length === 0) {
            setErrorMessage('Por favor, selecione pelo menos um arquivo.');
            return;
        }

        setIsProcessing(true);
        setErrorMessage(null);

        try {
            await onUpload(uploadedFiles);
            setSuccessMessage('Exames anexados com sucesso!');

            // Delay closing to show success message
            setTimeout(() => {
                clearFiles();
                setSuccessMessage(null);
                setIsProcessing(false);
                onClose();
            }, 1500);

        } catch (error) {
            console.error('Erro no upload:', error);
            setErrorMessage('Falha ao enviar exames. Tente novamente.');
            setIsProcessing(false);
        }
    };

    const handleClose = () => {
        if (!isProcessing) {
            clearFiles();
            setErrorMessage(null);
            setSuccessMessage(null);
            onClose();
        }
    };

    const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if ((e.target as HTMLElement).classList.contains('exam-modal-overlay')) {
            handleClose();
        }
    };

    return (
        <div className="exam-modal-overlay" onClick={handleOverlayClick}>
            <div className="exam-modal-container" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="exam-modal-header">
                    <div className="exam-modal-title">
                        <h3>Anexar Exames</h3>
                        <p>Adicione documentos à consulta atual</p>
                    </div>
                    <button
                        onClick={handleClose}
                        disabled={isProcessing}
                        className="exam-modal-close"
                        aria-label="Fechar modal"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="exam-modal-content">
                    <div className="exam-info-box">
                        <div className="exam-info-icon">
                            <FileText size={20} />
                        </div>
                        <div className="exam-info-text">
                            <strong>Formatos Suportados</strong>
                            <span>PDF, DOC, DOCX, JPG, PNG (Máx 10MB)</span>
                        </div>
                    </div>

                    <FileUpload
                        onFilesChange={handleFilesChange}
                        maxFiles={10}
                        maxSizePerFile={10}
                        acceptedTypes={['application/pdf', '.doc', '.docx', 'image/jpeg', 'image/png']}
                        disabled={isProcessing}
                    />

                    {errorMessage && (
                        <div className="exam-alert error">
                            <AlertCircle size={16} />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="exam-alert success">
                            <CheckCircle size={16} />
                            <span>{successMessage}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="exam-modal-footer">
                    <button
                        onClick={handleClose}
                        disabled={isProcessing}
                        className="btn-exam-cancel"
                    >
                        Cancelar
                    </button>

                    <button
                        onClick={handleSubmit}
                        disabled={isProcessing || uploadedFiles.length === 0}
                        className="btn-exam-submit"
                    >
                        {isProcessing ? (
                            <>
                                <div className="spinner"></div>
                                <span>Enviando...</span>
                            </>
                        ) : (
                            <>
                                <Upload size={18} />
                                <span>Confirmar Envio</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
