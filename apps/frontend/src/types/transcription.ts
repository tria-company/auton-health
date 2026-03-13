export type Speaker = 'MEDICO' | 'PACIENTE' | 'SISTEMA' | 'UNKNOWN';

export interface TranscriptionSegment {
  id: string;
  text: string;
  speaker: Speaker;
  participantId?: string;
  participantName?: string;
  confidence?: number;
  start_time?: number;
  end_time?: number;
  timestamp: string;
  final?: boolean;
  language?: string;
}
