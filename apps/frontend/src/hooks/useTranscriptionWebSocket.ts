import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

import { TranscriptionSegment } from '@/types/transcription';

interface UseTranscriptionWebSocketProps {
  roomName: string;
  participantId: string;
  consultationId: string;
  enabled?: boolean;
  gatewayUrl?: string;
}

export function useTranscriptionWebSocket({
  roomName,
  participantId,
  consultationId,
  enabled = true,
  gatewayUrl = process.env.NEXT_PUBLIC_REALTIME_WS_URL || 'ws://localhost:3002'
}: UseTranscriptionWebSocketProps) {
  const [transcriptions, setTranscriptions] = useState<TranscriptionSegment[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);

  // ADICIONE ESTE LOG NO INÍCIO
  console.log('🔍 Hook useTranscriptionWebSocket iniciado com:', {
    roomName,
    participantId,
    consultationId,
    enabled,
    gatewayUrl
  });



  // Conectar ao WebSocket
  useEffect(() => {
    if (!enabled || !roomName || !participantId) return;

    console.log('🔗 Conectando ao serviço de transcrição...');

    // Agora usamos diretamente a URL do Realtime Service (já deve ser ws:// ou wss://)
    const socketUrl = gatewayUrl;
    socketRef.current = io(`${socketUrl}/transcription`, {
      transports: ['websocket'],
      autoConnect: true
    });

    const socket = socketRef.current;

    // Event listeners
    socket.on('connect', () => {
      console.log('✅ Conectado ao serviço de transcrição');
      setIsConnected(true);
      setError(null);

      // Entrar na sala de transcrição
      socket.emit('join-transcription-room', {
        roomName,
        participantId,
        consultationId
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Desconectado do serviço de transcrição');
      setIsConnected(false);
    });

    socket.on('transcription-joined', (data) => {
      console.log('🎉 Entrou na sala de transcrição:', data);
    });

    socket.on('transcription-segment', (data) => {
      console.log('📝 Nova transcrição recebida:', data.segment);
      const { segment } = data;
      setTranscriptions(prev => [...prev, segment]);
    });

    socket.on('error', (data) => {
      console.error('❌ Erro na transcrição:', data);
      setError(data.message || 'Erro desconhecido');
    });

    return () => {
      if (socket.connected) {
        socket.emit('leave-transcription-room', { roomName });
        socket.disconnect();
      }
    };
  }, [enabled, roomName, participantId, consultationId, gatewayUrl]);

  // Configurar captura de áudio do LiveKit
  useEffect(() => {
    if (!enabled || !isConnected || !socketRef.current) return;

    console.log('🎤 Tentando usar áudio do LiveKit para transcrição...');

    // Tentar acessar o contexto de áudio do LiveKit
    const tryCaptureLiveKitAudio = () => {
      // Buscar elementos de áudio do LiveKit
      const audioElements = document.querySelectorAll('audio');
      console.log('🔍 Elementos de áudio encontrados:', audioElements.length);

      if (audioElements.length > 0) {
        audioElements.forEach((audio, index) => {
          console.log(`🎵 Áudio ${index}:`, audio.srcObject);

          if (audio.srcObject) {
            try {
              const stream = audio.srcObject as MediaStream;
              const audioTracks = stream.getAudioTracks();

              if (audioTracks.length > 0) {
                console.log('✅ Track de áudio encontrado, iniciando captura...');
                startAudioProcessing(stream);
                return;
              }
            } catch (error) {
              console.error('Erro ao processar stream:', error);
            }
          }
        });
      }

      // Se não encontrou áudio do LiveKit, tentar acesso direto
      if (audioElements.length === 0) {
        console.log('⚠️ Áudio do LiveKit não encontrado, tentando acesso direto...');
        startDirectAudioCapture();
      }
    };

    const startAudioProcessing = (stream: MediaStream) => {
      try {
        mediaStreamRef.current = stream;

        // Criar contexto de áudio
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        const source = audioContextRef.current.createMediaStreamSource(stream);

        // Criar processador
        processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);

        processorRef.current.onaudioprocess = (event) => {
          if (!socketRef.current?.connected) return;

          const inputData = event.inputBuffer.getChannelData(0);

          // Verificar se há áudio (não silêncio)
          const hasAudio = inputData.some(sample => Math.abs(sample) > 0.01);
          if (!hasAudio) return;

          // Converter e enviar
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            int16Data[i] = Math.max(-32768, Math.min(32767, inputData[i] * 32768));
          }

          const audioData = Buffer.from(int16Data.buffer).toString('base64');

          console.log('📤 Enviando áudio para transcrição...');

          socketRef.current.emit('audio-data', {
            roomName,
            participantId,
            audioData,
            sampleRate: 16000,
            channels: 1
          });
        };

        // Conectar nós
        source.connect(processorRef.current);
        processorRef.current.connect(audioContextRef.current.destination);

        console.log('🎵 Processamento de áudio iniciado!');

      } catch (error) {
        console.error('❌ Erro no processamento:', error);
        setError('Erro ao processar áudio');
      }
    };

    const startDirectAudioCapture = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false
          }
        });

        console.log('✅ Acesso direto ao microfone obtido');
        startAudioProcessing(stream);

      } catch (error) {
        console.error('❌ Erro no acesso direto:', error);
        setError('Não foi possível acessar o microfone');
      }
    };

    // Aguardar áudio carregar completamente
    const timeout = setTimeout(() => {
      tryCaptureLiveKitAudio();
    }, 3000);

    return () => {
      clearTimeout(timeout);

      // Limpar recursos
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }

      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }

      // Limpar stream
      if (mediaStreamRef.current) {
        const tracks = mediaStreamRef.current.getTracks();
        tracks.forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, [enabled, isConnected, roomName, participantId]);

  // Funções de controle
  const startTranscription = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('start-transcription', {
        roomName,
        consultationId
      });
    }
  };

  const stopTranscription = () => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('stop-transcription', {
        roomName
      });
    }
  };

  const clearTranscriptions = () => {
    setTranscriptions([]);
  };

  return {
    transcriptions,
    isConnected,
    error,
    startTranscription,
    stopTranscription,
    clearTranscriptions
  };
}