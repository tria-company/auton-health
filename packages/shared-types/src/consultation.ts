export type ConsultationStatus = 'SCHEDULED' | 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type ConsultationType = 'ONLINE' | 'PRESENCIAL';

export interface Consultation {
    id: string;
    patient_id: string;
    doctor_id: string;
    room_id?: string;
    status: ConsultationStatus;
    type: ConsultationType;
    scheduled_at?: string;
    started_at?: string;
    ended_at?: string;
    created_at: string;
    updated_at: string;
    metadata?: Record<string, any>;
}

export interface Room {
    id: string; // usually same as room_id in consultation
    consultation_id: string;
    active: boolean;
    participants: number;
    created_at: string;
    last_activity_at: string;
}
