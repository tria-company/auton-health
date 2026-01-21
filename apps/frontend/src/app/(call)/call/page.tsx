'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function CallRoomContent() {
  const searchParams = useSearchParams();
  const roomId = searchParams.get('roomId');

  // Se não houver roomId, mostrar mensagem amigável
  if (!roomId) {
    return (
      <div className="call-room">
        <div className="page-header">
          <h1 className="page-title">Sala de Consulta</h1>
          <p className="page-subtitle">
            Nenhuma sala especificada
          </p>
        </div>

        <div className="call-content">
          <div className="call-placeholder">
            <h2>Consulta Online</h2>
            <p>Por favor, acesse uma sala válida para iniciar a consulta.</p>
            <p className="text-muted">Formato: /call?roomId=XXXX</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="call-room">
      <div className="page-header">
        <h1 className="page-title">Sala de Consulta</h1>
        <p className="page-subtitle">
          Consulta online - Sala: {roomId}
        </p>
      </div>

      <div className="call-content">
        <div className="call-placeholder">
          <h2>Consulta Online</h2>
          <p>Funcionalidade de consulta online será implementada em breve.</p>
          <p>Sala ID: {roomId}</p>
        </div>
      </div>
    </div>
  );
}

export default function CallRoomPage() {
  return (
    <Suspense fallback={
      <div className="loading-page">
        <div className="loading-spinner" />
        <p>Carregando sala de consulta...</p>
      </div>
    }>
      <CallRoomContent />
    </Suspense>
  );
}
