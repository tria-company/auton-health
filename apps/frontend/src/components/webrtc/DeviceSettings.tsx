import React from 'react';
import { Mic, Video, Volume2, Check, Settings, RefreshCw } from 'lucide-react';
import { useMediaDevices } from '@/hooks/useMediaDevices';

interface DeviceSettingsProps {
    devices: ReturnType<typeof useMediaDevices>;
    onDeviceSelect: (kind: 'audioinput' | 'videoinput' | 'audiooutput', deviceId: string) => void;
    className?: string;
    isOpen: boolean;
    onClose: () => void;
}

export function DeviceSettings({ devices, onDeviceSelect, className = '', isOpen, onClose }: DeviceSettingsProps) {
    if (!isOpen) return null;

    return (
        <div className={`device-settings-modal ${className}`}>
            <div className="device-settings-content">
                <div className="device-settings-header">
                    <h3>Configurações de Áudio e Vídeo</h3>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="device-settings-body">
                    {/* Microfone */}
                    <div className="device-section">
                        <div className="device-label">
                            <Mic size={18} />
                            <span>Microfone</span>
                        </div>
                        <select
                            value={devices.selectedAudioInputId || ''}
                            onChange={(e) => onDeviceSelect('audioinput', e.target.value)}
                            className="device-select"
                        >
                            {devices.audioInputs.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label}
                                </option>
                            ))}
                            {devices.audioInputs.length === 0 && <option value="" disabled>Nenhum microfone detectado</option>}
                        </select>
                    </div>

                    {/* Câmera */}
                    <div className="device-section">
                        <div className="device-label">
                            <Video size={18} />
                            <span>Câmera</span>
                        </div>
                        <select
                            value={devices.selectedVideoInputId || ''}
                            onChange={(e) => onDeviceSelect('videoinput', e.target.value)}
                            className="device-select"
                        >
                            {devices.videoInputs.map((device) => (
                                <option key={device.deviceId} value={device.deviceId}>
                                    {device.label}
                                </option>
                            ))}
                            {devices.videoInputs.length === 0 && <option value="" disabled>Nenhuma câmera detectada</option>}
                        </select>
                    </div>

                    {/* Saída de Áudio (Speakers) */}
                    {devices.audioOutputs.length > 0 && (
                        <div className="device-section">
                            <div className="device-label">
                                <Volume2 size={18} />
                                <span>Saída de Áudio</span>
                            </div>
                            <select
                                value={devices.selectedAudioOutputId || ''}
                                onChange={(e) => onDeviceSelect('audiooutput', e.target.value)}
                                className="device-select"
                            >
                                {devices.audioOutputs.map((device) => (
                                    <option key={device.deviceId} value={device.deviceId}>
                                        {device.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="device-info-hint">
                        <p>Seus dispositivos foram detectados automaticamente.</p>
                        <p className="sub-hint">Se conectou um novo dispositivo, ele deve aparecer na lista.</p>
                    </div>
                </div>

                <div className="device-settings-footer">
                    <button className="done-btn" onClick={onClose}>
                        <Check size={16} />
                        <span>Concluído</span>
                    </button>
                </div>
            </div>

            <style jsx>{`
        .device-settings-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          backdrop-filter: blur(4px);
        }

        .device-settings-content {
          background-color: white;
          border-radius: 12px;
          width: 90%;
          max-width: 450px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          overflow: hidden;
          animation: scaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .device-settings-header {
          padding: 1.5rem;
          border-bottom: 1px solid #eee;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .device-settings-header h3 {
          margin: 0;
          font-size: 1.25rem;
          color: #1B4266;
          font-weight: 600;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 2rem;
          line-height: 1;
          color: #999;
          cursor: pointer;
          padding: 0;
        }

        .device-settings-body {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .device-section {
          background-color: #f8f9fa;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
        }

        .device-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          color: #4b5563;
          font-weight: 500;
          font-size: 0.95rem;
        }

        .device-select {
          width: 100%;
          padding: 0.75rem;
          border-radius: 6px;
          border: 1px solid #d1d5db;
          background-color: white;
          font-size: 0.95rem;
          color: #1f2937;
          outline: none;
          transition: border-color 0.2s;
        }

        .device-select:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
        }

        .device-info-hint {
          font-size: 0.85rem;
          color: #6b7280;
          text-align: center;
          margin-top: 0.5rem;
        }
        
        .sub-hint {
          font-size: 0.8rem;
          color: #9ca3af;
          margin-top: 0.25rem;
        }

        .device-settings-footer {
          padding: 1rem 1.5rem;
          background-color: #f8f9fa;
          border-top: 1px solid #eee;
          display: flex;
          justify-content: flex-end;
        }

        .done-btn {
          background-color: #1B4266;
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: background-color 0.2s;
        }

        .done-btn:hover {
          background-color: #2c5282;
        }

        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
        </div>
    );
}
