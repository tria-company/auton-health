export type Speaker = 'MEDICO' | 'PACIENTE' | 'SISTEMA' | 'UNKNOWN';

export interface TranscriptionSegment {
    id: string;
    text: string;
    speaker: Speaker;
    participantId?: string;
    participantName?: string;
    confidence?: number;
    start_time?: number; // relative to recording start in seconds
    end_time?: number; // relative to recording start in seconds
    timestamp: string; // ISO string of when this segment was finalized
    final?: boolean;
    language?: string;
}

export interface Transcription {
    id: string;
    consultation_id: string;
    room_id: string;
    segments: TranscriptionSegment[];
    full_text?: string; // Aggregated text if needed
    created_at: string;
    updated_at: string;
    status: 'PROCESSING' | 'COMPLETED' | 'FAILED';
}

export interface AudioMetadata {
    duration: number;
    sample_rate: number;
    channels: number;
    format: string;
    file_size: number;
}
