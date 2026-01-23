'use client';

import { useEffect, useRef } from 'react';
import { Stethoscope, User } from 'lucide-react';
import { formatDuration } from '@/lib/audioUtils';

import { TranscriptionSegment } from '@medcall/shared-types';

interface PresencialTranscriptionProps {
  transcriptions: TranscriptionSegment[];
  doctorName?: string;
  patientName?: string;
}

export function PresencialTranscription({
  transcriptions,
  doctorName = 'Médico',
  patientName = 'Paciente'
}: PresencialTranscriptionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para última transcrição
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [transcriptions]);

  return (
    <div className="presencial-transcription">
      <div className="transcription-header">
        <h3>Transcrição em Tempo Real</h3>
        <span className="transcription-count">{transcriptions.length} mensagens</span>
      </div>

      <div ref={containerRef} className="transcription-container">
        {transcriptions.length === 0 ? (
          <div className="empty-state">
            <p>Aguardando transcrições...</p>
            <p className="hint">As falas serão transcritas em tempo real</p>
          </div>
        ) : (
          transcriptions.map((t, index) => (
            <div
              key={t.id || index}
              className={`transcription-item ${t.speaker === 'MEDICO' ? 'doctor' : 'patient'}`}
            >
              <div className="transcription-header-item">
                <span className="speaker-name">
                  {(t.speaker === 'MEDICO') ? (
                    <>
                      <Stethoscope className="speaker-icon" size={16} />
                      {doctorName}
                    </>
                  ) : (
                    <>
                      <User className="speaker-icon" size={16} />
                      {patientName}
                    </>
                  )}
                </span>
                <span className="timestamp">
                  {new Date(t.timestamp).toLocaleTimeString('pt-BR')}
                </span>
              </div>
              <p className="transcription-text">{t.text}</p>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .presencial-transcription {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          border: 1px solid #E5E7EB;
        }
        
        .transcription-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 2px solid #E5E7EB;
          background: #F9FAFB;
        }
        
        .transcription-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 700;
          color: #1B4266;
        }
        
        .transcription-count {
          font-size: 14px;
          color: #1B4266;
          background: white;
          padding: 6px 14px;
          border-radius: 20px;
          font-weight: 600;
          border: 1px solid #E5E7EB;
        }
        
        .transcription-container {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          background: #FAFBFC;
          min-height: 0;
        }
        
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: #6b7280;
        }
        
        .empty-state p {
          margin: 4px 0;
          text-align: center;
          font-size: 16px;
        }
        
        .empty-state .hint {
          font-size: 14px;
          color: #9ca3af;
        }
        
        .transcription-item {
          padding: 16px 20px;
          border-radius: 10px;
          border-left: 4px solid #E5E7EB;
          background: white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        
        .transcription-item.doctor {
          background: #EBF5FF;
          border-left-color: #1B4266;
        }
        
        .transcription-item.patient {
          background: #F0FDF4;
          border-left-color: #10B981;
        }
        
        .transcription-header-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        
        .speaker-name {
          font-size: 15px;
          font-weight: 600;
          color: #1B4266;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        
        .speaker-icon {
          color: #1B4266;
          flex-shrink: 0;
        }
        
        .timestamp {
          font-size: 12px;
          color: #6b7280;
          font-weight: 500;
        }
        
        .transcription-text {
          margin: 0;
          font-size: 15px;
          line-height: 1.6;
          color: #374151;
        }
        
        .transcription-container::-webkit-scrollbar {
          width: 10px;
        }
        
        .transcription-container::-webkit-scrollbar-track {
          background: #F3F4F6;
          border-radius: 5px;
        }
        
        .transcription-container::-webkit-scrollbar-thumb {
          background: #1B4266;
          border-radius: 5px;
        }
        
        .transcription-container::-webkit-scrollbar-thumb:hover {
          background: #153350;
        }
      `}</style>
    </div>
  );
}
