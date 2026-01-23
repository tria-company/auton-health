'use client';

import { useRef, useEffect } from 'react';
import { FileText, User, Clock } from 'lucide-react';
import { TranscriptionSegment } from '@medcall/shared-types';

interface TranscriptionPanelProps {
  utterances: TranscriptionSegment[];
  scrollRef?: React.RefObject<HTMLDivElement>;
}

export function TranscriptionPanel({ utterances, scrollRef }: TranscriptionPanelProps) {
  return (
    <div className="transcription-panel">
      <div className="transcription-header">
        <h4>
          <FileText className="w-4 h-4" />
          Transcrição em Tempo Real
        </h4>
        <span className="utterance-count">{utterances.length} falas</span>
      </div>

      <div className="transcription-content" ref={scrollRef}>
        {utterances.length === 0 ? (
          <div className="transcription-empty">
            <FileText className="w-8 h-8 opacity-50" />
            <p>Aguardando transcrição...</p>
          </div>
        ) : (
          utterances.map((utterance) => (
            <div
              key={utterance.id}
              className={`utterance utterance-${utterance.speaker.toLowerCase()}`}
            >
              <div className="utterance-header">
                <div className="speaker-info">
                  <User className="w-3 h-3" />
                  <span className="speaker-name">
                    {utterance.speaker === 'MEDICO' ? 'Médico' :
                      utterance.speaker === 'PACIENTE' ? 'Paciente' :
                        utterance.participantName || 'Desconhecido'}
                  </span>
                </div>
                <div className="utterance-meta">
                  <Clock className="w-3 h-3" />
                  <span className="timestamp">
                    {new Date(utterance.timestamp).toLocaleTimeString()}
                  </span>
                  {utterance.confidence && (
                    <span className="confidence">
                      {Math.round(utterance.confidence * 100)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="utterance-text">
                {utterance.text}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
