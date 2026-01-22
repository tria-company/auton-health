'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // em segundos
  error: string | null;
  isUploading: boolean;
  uploadProgress: number;
  recordingUrl: string | null;
}

export interface RecordingConfig {
  sessionId: string;
  consultationId?: string;
  roomId: string;
  userName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onRecordingComplete?: (url: string) => void;
  onError?: (error: string) => void;
  // Intervalo para salvar chunks (em ms) - default 5 minutos
  chunkInterval?: number;
}

interface RecordingChunk {
  blob: Blob;
  index: number;
  timestamp: number;
}

/**
 * Hook para gerenciar gravação de consultas WebRTC
 * Grava ambos os streams (local + remoto) em formato WebM
 */
export function useRecording() {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    error: null,
    isUploading: false,
    uploadProgress: 0,
    recordingUrl: null,
  });

  // Refs para controle interno
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const combinedStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const configRef = useRef<RecordingConfig | null>(null);
  const startTimeRef = useRef<number>(0);
  const chunkIndexRef = useRef<number>(0);

  // AudioContext para mixar streams de áudio
  const audioContextRef = useRef<AudioContext | null>(null);
  const destinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  /**
   * Combina streams de áudio local e remoto usando Web Audio API
   */
  const combineAudioStreams = useCallback((
    localStream: MediaStream | null,
    remoteStream: MediaStream | null
  ): MediaStreamTrack | null => {
    try {
      // Criar AudioContext se não existir
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      const audioContext = audioContextRef.current;

      // Criar destination para o áudio mixado
      if (!destinationRef.current) {
        destinationRef.current = audioContext.createMediaStreamDestination();
      }

      const destination = destinationRef.current;

      // Conectar áudio local se existir
      if (localStream) {
        const localAudioTracks = localStream.getAudioTracks();
        if (localAudioTracks.length > 0) {
          const localSource = audioContext.createMediaStreamSource(
            new MediaStream([localAudioTracks[0]])
          );
          // Adicionar ganho para controlar volume
          const localGain = audioContext.createGain();
          localGain.gain.value = 1.0;
          localSource.connect(localGain);
          localGain.connect(destination);
          console.log('🎤 [RECORDING] Áudio local conectado');
        }
      }

      // Conectar áudio remoto se existir
      if (remoteStream) {
        const remoteAudioTracks = remoteStream.getAudioTracks();
        if (remoteAudioTracks.length > 0) {
          const remoteSource = audioContext.createMediaStreamSource(
            new MediaStream([remoteAudioTracks[0]])
          );
          // Adicionar ganho para controlar volume
          const remoteGain = audioContext.createGain();
          remoteGain.gain.value = 1.0;
          remoteSource.connect(remoteGain);
          remoteGain.connect(destination);
          console.log('🔊 [RECORDING] Áudio remoto conectado');
        }
      }

      // Retornar a track de áudio mixada
      const mixedAudioTracks = destination.stream.getAudioTracks();
      return mixedAudioTracks.length > 0 ? mixedAudioTracks[0] : null;

    } catch (error) {
      console.error('❌ [RECORDING] Erro ao combinar áudios:', error);
      return null;
    }
  }, []);

  /**
   * Cria um canvas para combinar vídeos lado a lado (picture-in-picture)
   */
  const combineVideoStreams = useCallback((
    localStream: MediaStream | null,
    remoteStream: MediaStream | null
  ): MediaStreamTrack | null => {
    try {
      // Criar canvas para composição de vídeo
      const canvas = document.createElement('canvas');
      // Resolução 720p para o vídeo combinado
      canvas.width = 1280;
      canvas.height = 720;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        console.error('❌ [RECORDING] Não foi possível criar contexto 2D');
        return null;
      }

      // Criar elementos de vídeo para capturar os streams
      const localVideo = document.createElement('video');
      localVideo.muted = true;
      localVideo.playsInline = true;
      localVideo.autoplay = true;

      const remoteVideo = document.createElement('video');
      remoteVideo.muted = true;
      remoteVideo.playsInline = true;
      remoteVideo.autoplay = true;

      // Atribuir streams aos vídeos
      if (localStream) {
        localVideo.srcObject = new MediaStream(localStream.getVideoTracks());
        localVideo.play().catch(console.error);
      }

      if (remoteStream) {
        remoteVideo.srcObject = new MediaStream(remoteStream.getVideoTracks());
        remoteVideo.play().catch(console.error);
      }

      // Função para desenhar no canvas
      const drawFrame = () => {
        // Fundo preto
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Layout: Vídeo remoto grande, local no canto (picture-in-picture)
        if (remoteStream && remoteVideo.readyState >= 2) {
          // Vídeo remoto ocupa tela toda
          ctx.drawImage(remoteVideo, 0, 0, canvas.width, canvas.height);
        }

        if (localStream && localVideo.readyState >= 2) {
          // Vídeo local no canto inferior direito (20% do tamanho)
          const pipWidth = canvas.width * 0.25;
          const pipHeight = canvas.height * 0.25;
          const pipX = canvas.width - pipWidth - 20;
          const pipY = canvas.height - pipHeight - 20;

          // Borda do PIP
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.strokeRect(pipX - 2, pipY - 2, pipWidth + 4, pipHeight + 4);

          // Desenhar vídeo local
          ctx.drawImage(localVideo, pipX, pipY, pipWidth, pipHeight);
        }

        // Timestamp no vídeo
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(10, 10, 180, 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        const now = new Date();
        ctx.fillText(
          `🔴 REC ${now.toLocaleTimeString('pt-BR')}`,
          20,
          30
        );

        // Continuar animação enquanto estiver gravando
        if (mediaRecorderRef.current?.state === 'recording') {
          requestAnimationFrame(drawFrame);
        }
      };

      // Iniciar animação após vídeos carregarem
      setTimeout(() => {
        drawFrame();
      }, 500);

      // Capturar stream do canvas (30 FPS)
      const canvasStream = canvas.captureStream(30);
      const videoTrack = canvasStream.getVideoTracks()[0];

      console.log('📹 [RECORDING] Stream de vídeo combinado criado');
      return videoTrack;

    } catch (error) {
      console.error('❌ [RECORDING] Erro ao combinar vídeos:', error);
      return null;
    }
  }, []);

  /**
   * Faz upload de um chunk para o servidor
   */
  const uploadChunk = useCallback(async (
    blob: Blob,
    chunkIndex: number,
    isFinal: boolean = false
  ): Promise<string | null> => {
    if (!configRef.current) {
      console.error('❌ [RECORDING] Config não encontrada para upload');
      return null;
    }

    const config = configRef.current;

    // Garantir que usamos HTTP/HTTPS para upload (não WebSocket)
    let gatewayUrl = process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://localhost:3001';

    // Converter ws/wss para http/https
    gatewayUrl = gatewayUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');

    // FIX: Se estiver no frontend em HTTPS, garantir que o gateway use HTTPS também
    // para evitar erro de Mixed Content (bloqueio de http inseguro)
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && gatewayUrl.startsWith('http://')) {
      console.log('🔒 [RECORDING] Frontend em HTTPS detectado. Forçando upgrade do gateway para HTTPS.');
      gatewayUrl = gatewayUrl.replace(/^http:\/\//i, 'https://');
    }

    console.log('📤 [RECORDING] Iniciando upload...', {
      blobSize: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
      blobType: blob.type,
      chunkIndex,
      isFinal,
      gatewayUrl,
      sessionId: config.sessionId,
    });

    try {
      setState(prev => ({ ...prev, isUploading: true }));

      const formData = new FormData();
      const filename = isFinal
        ? `recording_${config.sessionId}_final.webm`
        : `recording_${config.sessionId}_chunk_${chunkIndex.toString().padStart(4, '0')}.webm`;

      // Garantir que o blob tenha o mimetype correto
      const blobWithType = new Blob([blob], { type: 'video/webm' });
      formData.append('recording', blobWithType, filename);

      console.log('📤 [RECORDING] Blob preparado:', {
        originalType: blob.type,
        newType: blobWithType.type,
        size: blobWithType.size,
      });
      formData.append('sessionId', config.sessionId);
      formData.append('roomId', config.roomId);
      formData.append('chunkIndex', chunkIndex.toString());
      formData.append('isFinal', isFinal.toString());
      formData.append('timestamp', Date.now().toString());

      if (config.consultationId) {
        formData.append('consultationId', config.consultationId);
      }

      console.log('📤 [RECORDING] Enviando para:', `${gatewayUrl}/api/recordings/upload`);

      const response = await fetch(`${gatewayUrl}/api/recordings/upload`, {
        method: 'POST',
        body: formData,
      });

      console.log('📤 [RECORDING] Response status:', response.status, response.statusText);

      if (!response.success) {
        const errorText = await response.text();
        console.error('❌ [RECORDING] Erro na resposta:', errorText);
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`✅ [RECORDING] Upload concluído:`, result);

      setState(prev => ({
        ...prev,
        isUploading: false,
        uploadProgress: isFinal ? 100 : prev.uploadProgress + 10,
        recordingUrl: result.url || prev.recordingUrl
      }));

      return result.url;

    } catch (error) {
      console.error('❌ [RECORDING] Erro no upload:', error);
      setState(prev => ({
        ...prev,
        isUploading: false,
        error: `Erro no upload: ${error instanceof Error ? error.message : 'Desconhecido'}`
      }));

      // Chamar callback de erro se configurado
      if (configRef.current?.onError) {
        configRef.current.onError(`Erro no upload: ${error instanceof Error ? error.message : 'Desconhecido'}`);
      }

      return null;
    }
  }, []);

  /**
   * Inicia a gravação
   */
  const startRecording = useCallback(async (config: RecordingConfig) => {
    try {
      console.log('🎬 [RECORDING] Tentando iniciar gravação...');

      // Validações detalhadas
      console.log('🎬 [RECORDING] Config recebida:', {
        sessionId: config.sessionId,
        roomId: config.roomId,
        userName: config.userName,
        hasLocalStream: !!config.localStream,
        hasRemoteStream: !!config.remoteStream,
        localStreamTracks: config.localStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
        remoteStreamTracks: config.remoteStream?.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled, readyState: t.readyState })),
      });

      if (!config.localStream && !config.remoteStream) {
        const error = 'Pelo menos um stream (local ou remoto) é necessário';
        console.error('❌ [RECORDING]', error);
        throw new Error(error);
      }

      // Verificar se MediaRecorder está disponível
      if (typeof MediaRecorder === 'undefined') {
        const error = 'MediaRecorder não está disponível neste navegador';
        console.error('❌ [RECORDING]', error);
        throw new Error(error);
      }

      console.log('🎬 [RECORDING] Iniciando gravação...', {
        sessionId: config.sessionId,
        hasLocalStream: !!config.localStream,
        hasRemoteStream: !!config.remoteStream
      });

      configRef.current = config;
      chunksRef.current = [];
      chunkIndexRef.current = 0;

      // Combinar streams de áudio e vídeo
      const combinedTracks: MediaStreamTrack[] = [];

      console.log('🎥 [RECORDING] Combinando streams...');

      // Tentar combinar vídeos (pode falhar em alguns navegadores)
      try {
        const combinedVideoTrack = combineVideoStreams(config.localStream, config.remoteStream);
        if (combinedVideoTrack) {
          combinedTracks.push(combinedVideoTrack);
          console.log('✅ [RECORDING] Vídeo combinado criado');
        }
      } catch (videoError) {
        console.warn('⚠️ [RECORDING] Erro ao combinar vídeos, usando streams originais:', videoError);
        // Fallback: usar track de vídeo original (preferir remoto)
        if (config.remoteStream?.getVideoTracks()[0]) {
          combinedTracks.push(config.remoteStream.getVideoTracks()[0]);
          console.log('✅ [RECORDING] Usando vídeo remoto original');
        } else if (config.localStream?.getVideoTracks()[0]) {
          combinedTracks.push(config.localStream.getVideoTracks()[0]);
          console.log('✅ [RECORDING] Usando vídeo local original');
        }
      }

      // Tentar combinar áudios
      try {
        const combinedAudioTrack = combineAudioStreams(config.localStream, config.remoteStream);
        if (combinedAudioTrack) {
          combinedTracks.push(combinedAudioTrack);
          console.log('✅ [RECORDING] Áudio combinado criado');
        }
      } catch (audioError) {
        console.warn('⚠️ [RECORDING] Erro ao combinar áudios, usando streams originais:', audioError);
        // Fallback: adicionar áudios separados
        if (config.remoteStream?.getAudioTracks()[0]) {
          combinedTracks.push(config.remoteStream.getAudioTracks()[0]);
          console.log('✅ [RECORDING] Usando áudio remoto original');
        }
        if (config.localStream?.getAudioTracks()[0]) {
          combinedTracks.push(config.localStream.getAudioTracks()[0]);
          console.log('✅ [RECORDING] Usando áudio local original');
        }
      }

      console.log('🎥 [RECORDING] Total de tracks combinadas:', combinedTracks.length);

      if (combinedTracks.length === 0) {
        const error = 'Não foi possível criar tracks combinadas - nenhum stream válido';
        console.error('❌ [RECORDING]', error);
        throw new Error(error);
      }

      // Criar stream combinado
      const combinedStream = new MediaStream(combinedTracks);
      combinedStreamRef.current = combinedStream;
      console.log('✅ [RECORDING] Stream combinado criado com', combinedStream.getTracks().length, 'tracks');

      // Detectar melhor codec suportado
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264,opus',
        'video/webm',
        'video/mp4',
      ];

      console.log('🎥 [RECORDING] Verificando suporte a codecs...');

      let selectedMimeType = '';
      for (const mimeType of mimeTypes) {
        const isSupported = MediaRecorder.isTypeSupported(mimeType);
        console.log(`🎥 [RECORDING] ${mimeType}: ${isSupported ? '✅' : '❌'}`);
        if (isSupported && !selectedMimeType) {
          selectedMimeType = mimeType;
        }
      }

      if (!selectedMimeType) {
        const error = 'Nenhum codec WebM suportado pelo navegador';
        console.error('❌ [RECORDING]', error);
        throw new Error(error);
      }

      console.log('🎥 [RECORDING] Usando codec:', selectedMimeType);

      // Criar MediaRecorder
      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType: selectedMimeType,
        videoBitsPerSecond: 2500000, // 2.5 Mbps
        audioBitsPerSecond: 128000,  // 128 kbps
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handler para chunks de dados
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`📦 [RECORDING] Chunk recebido: ${(event.data.size / 1024).toFixed(2)} KB`);
        }
      };

      // Handler para quando a gravação parar
      mediaRecorder.onstop = async () => {
        console.log('⏹️ [RECORDING] Gravação finalizada');

        // Criar blob final com todos os chunks
        const finalBlob = new Blob(chunksRef.current, { type: selectedMimeType });
        console.log(`📼 [RECORDING] Tamanho final: ${(finalBlob.size / 1024 / 1024).toFixed(2)} MB`);

        // Upload final
        const url = await uploadChunk(finalBlob, chunkIndexRef.current, true);

        if (url && config.onRecordingComplete) {
          config.onRecordingComplete(url);
        }

        // Limpar recursos
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        destinationRef.current = null;

        // Parar tracks do stream combinado
        combinedStreamRef.current?.getTracks().forEach(track => track.stop());
        combinedStreamRef.current = null;
      };

      // Handler para erros
      mediaRecorder.onerror = (event: any) => {
        console.error('❌ [RECORDING] Erro no MediaRecorder:', event.error);
        setState(prev => ({
          ...prev,
          isRecording: false,
          error: `Erro na gravação: ${event.error?.message || 'Desconhecido'}`
        }));
        if (config.onError) {
          config.onError(event.error?.message || 'Erro desconhecido');
        }
      };

      // Iniciar gravação (coleta dados a cada 10 segundos)
      mediaRecorder.start(10000);
      startTimeRef.current = Date.now();

      // Iniciar contador de duração
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setState(prev => ({ ...prev, duration: elapsed }));
      }, 1000);

      // Configurar upload periódico de chunks (default: 5 minutos)
      const chunkIntervalMs = config.chunkInterval || 5 * 60 * 1000;
      chunkIntervalRef.current = setInterval(async () => {
        if (chunksRef.current.length > 0 && mediaRecorderRef.current?.state === 'recording') {
          // Criar blob dos chunks acumulados
          const chunkBlob = new Blob(chunksRef.current, { type: selectedMimeType });
          chunkIndexRef.current++;

          // Upload do chunk
          await uploadChunk(chunkBlob, chunkIndexRef.current, false);

          // Limpar chunks já enviados (manter para o arquivo final)
          // chunksRef.current = [];
        }
      }, chunkIntervalMs);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        error: null,
        isUploading: false,
        uploadProgress: 0,
        recordingUrl: null,
      });

      console.log('✅ [RECORDING] Gravação iniciada com sucesso');

    } catch (error) {
      console.error('❌ [RECORDING] Erro ao iniciar gravação:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      setState(prev => ({ ...prev, error: errorMessage }));
      if (config.onError) {
        config.onError(errorMessage);
      }
    }
  }, [combineAudioStreams, combineVideoStreams, uploadChunk]);

  /**
   * Para a gravação
   */
  const stopRecording = useCallback(async () => {
    console.log('⏹️ [RECORDING] Parando gravação...');

    // Limpar intervalos
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (chunkIntervalRef.current) {
      clearInterval(chunkIntervalRef.current);
      chunkIntervalRef.current = null;
    }

    // Parar MediaRecorder (vai disparar onstop)
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    setState(prev => ({ ...prev, isRecording: false, isPaused: false }));
  }, []);

  /**
   * Pausa a gravação
   */
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));
      console.log('⏸️ [RECORDING] Gravação pausada');
    }
  }, []);

  /**
   * Retoma a gravação
   */
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));
      console.log('▶️ [RECORDING] Gravação retomada');
    }
  }, []);

  /**
   * Formata duração em MM:SS ou HH:MM:SS
   */
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (chunkIntervalRef.current) {
        clearInterval(chunkIntervalRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      combinedStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, []);

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    formatDuration,
  };
}

