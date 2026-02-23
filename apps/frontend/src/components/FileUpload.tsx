'use client';

import React, { useState, useCallback } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle } from 'lucide-react';

export interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  url?: string;
  error?: string;
}

interface FileUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  maxSizePerFile?: number; // em MB
  disabled?: boolean;
}

export default function FileUpload({
  onFilesChange,
  maxFiles = 10,
  acceptedTypes = ['image/*', 'application/pdf', '.doc', '.docx'],
  maxSizePerFile = 10,
  disabled = false
}: FileUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);

  const validateFile = (file: File): string | null => {
    // Verificar tamanho
    if (file.size > maxSizePerFile * 1024 * 1024) {
      return `Arquivo muito grande. Máximo: ${maxSizePerFile}MB`;
    }

    // Verificar tipo (simplificado)
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    const mimeType = file.type;
    
    const isAccepted = acceptedTypes.some(type => {
      if (type.startsWith('.')) {
        return fileExtension === type;
      }
      if (type.endsWith('/*')) {
        return mimeType.startsWith(type.replace('/*', '/'));
      }
      return mimeType === type;
    });

    if (!isAccepted) {
      return 'Tipo de arquivo não permitido';
    }

    return null;
  };

  const addFiles = useCallback((newFiles: File[]) => {
    const validFiles: UploadedFile[] = [];
    const errors: string[] = [];

    newFiles.forEach(file => {
      if (files.length + validFiles.length >= maxFiles) {
        errors.push(`Máximo de ${maxFiles} arquivos permitidos`);
        return;
      }

      const error = validateFile(file);
      if (error) {
        errors.push(`${file.name}: ${error}`);
        return;
      }

      validFiles.push({
        file,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: 'pending'
      });
    });

    if (errors.length > 0) {
      console.error('Erros de validação:', errors);
      // Aqui você pode mostrar um toast ou alerta
    }

    const updatedFiles = [...files, ...validFiles];
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, maxFiles, maxSizePerFile, acceptedTypes, onFilesChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  }, [disabled, addFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    
    const selectedFiles = Array.from(e.target.files || []);
    addFiles(selectedFiles);
    
    // Limpar o input para permitir selecionar o mesmo arquivo novamente
    e.target.value = '';
  }, [disabled, addFiles]);

  const removeFile = useCallback((fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  const updateFileStatus = useCallback((fileId: string, updates: Partial<UploadedFile>) => {
    const updatedFiles = files.map(f => 
      f.id === fileId ? { ...f, ...updates } : f
    );
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  }, [files, onFilesChange]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} />;
      case 'error':     return <AlertCircle size={16} />;
      default:          return <FileText size={16} />;
    }
  };

  return (
    <div className="w-full">
      {/* Área de Drop */}
      <div
        className={`fu-dropzone${isDragOver ? ' dragover' : ''}${disabled ? ' disabled' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Ícone central */}
        <div className="fu-icon-wrapper">
          <FileText className="fu-icon-file" />
          <div className="fu-icon-badge">
            <Upload size={12} />
          </div>
        </div>

        {/* Texto */}
        <p className="fu-dropzone-text">
          Arraste e solte aqui ou{' '}
          <label className="fu-choose-link">
            Escolher arquivo
            <input
              type="file"
              multiple
              accept={acceptedTypes.join(',')}
              onChange={handleFileInput}
              style={{ display: 'none' }}
              disabled={disabled}
            />
          </label>
        </p>

        {/* Meta info */}
        <div className="fu-dropzone-meta">
          <span>Formatos: PDF, DOC, DOCX, JPG, PNG</span>
          <span>Máx {maxSizePerFile}MB cada</span>
        </div>
      </div>

      {/* Lista de Arquivos */}
      {files.length > 0 && (
        <div className="fu-file-list">
          <p className="fu-file-list-title">Arquivos selecionados ({files.length})</p>
          {files.map((file) => (
            <div key={file.id} className="fu-file-item">
              <div className={`fu-file-icon ${file.status}`}>
                {getStatusIcon(file.status)}
              </div>

              <div className="fu-file-details">
                <p className="fu-file-name">{file.file.name}</p>
                <div className="fu-file-meta">
                  <span className="fu-file-size">{formatFileSize(file.file.size)}</span>
                  {file.status === 'uploading' && (
                    <>
                      <div className="fu-file-progress-bar-wrap">
                        <div
                          className="fu-file-progress-bar"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                      <span className="fu-file-progress-pct">{file.progress}%</span>
                    </>
                  )}
                </div>
                {file.error && <p className="fu-file-error">{file.error}</p>}
              </div>

              <button
                type="button"
                className="fu-file-remove"
                onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                disabled={file.status === 'uploading'}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Hook para usar o componente
export const useFileUpload = () => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

  const updateFile = (fileId: string, updates: Partial<UploadedFile>) => {
    setUploadedFiles(prev => 
      prev.map(f => f.id === fileId ? { ...f, ...updates } : f)
    );
  };

  const clearFiles = () => {
    setUploadedFiles([]);
  };

  return {
    uploadedFiles,
    setUploadedFiles,
    updateFile,
    clearFiles
  };
};
