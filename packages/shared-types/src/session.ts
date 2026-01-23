export interface Session {
    id: string;
    consultation_id: string;
    room_id: string;
    user_id: string;
    role: 'doctor' | 'patient';
    connected_at: string;
    disconnected_at?: string;
    duration_seconds?: number;
}
