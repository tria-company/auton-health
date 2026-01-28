'use client';

import { useEffect, useRef, useState } from 'react';

interface VideoPlayerProps {
    stream: MediaStream | null;
    muted?: boolean;
    className?: string;
    onPlaybackBlocked?: () => void;
    onPlaybackResumed?: () => void;
}

/**
 * Componente robusto para exibição de vídeo WebRTC.
 * 
 * Resolve problemas de:
 * - Tela preta após refresh
 * - Autoplay bloqueado pelo navegador
 * - Race conditions ao anexar stream
 * - Seleção de dispositivo de saída de áudio (setSinkId)
 */
export function VideoPlayer({
    stream,
    muted = false,
    className = '',
    audioOutputDeviceId,
    onPlaybackBlocked,
    onPlaybackResumed,
}: VideoPlayerProps & { audioOutputDeviceId?: string }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isBlocked, setIsBlocked] = useState(false);

    // ✅ Efeito reativo: Alterar saída de áudio (Speakers)
    useEffect(() => {
        const video = videoRef.current as any; // Cast to any to access setSinkId (experimental API)
        if (video && audioOutputDeviceId && typeof video.setSinkId === 'function') {
            console.log(`🔊 [VideoPlayer] Definindo saída de áudio para: ${audioOutputDeviceId}`);
            video.setSinkId(audioOutputDeviceId)
                .then(() => console.log(`✅ [VideoPlayer] Saída de áudio alterada com sucesso para ${audioOutputDeviceId}`))
                .catch((error: any) => console.error('❌ [VideoPlayer] Erro ao definir saída de áudio:', error));
        }
    }, [audioOutputDeviceId]);

    // ✅ Efeito reativo: anexa stream quando disponível
    useEffect(() => {
        const video = videoRef.current;
        if (!video || !stream) return;

        // Só atribuir se for um stream diferente
        if (video.srcObject !== stream) {
            console.log('📹 [VideoPlayer] Anexando novo stream:', stream.id);
            video.srcObject = stream;
        }

        // Tentar reproduzir
        const playVideo = async () => {
            try {
                // Começar mudo para bypass autoplay policy
                video.muted = true;
                await video.play();

                // Se não for para ficar mudo, desmutar após 500ms
                if (!muted) {
                    setTimeout(() => {
                        if (videoRef.current) {
                            videoRef.current.muted = false;
                            console.log('🔊 [VideoPlayer] Áudio desmutado');
                        }
                    }, 500);
                }

                setIsBlocked(false);
                onPlaybackResumed?.();
                console.log('▶️ [VideoPlayer] Reprodução iniciada');
            } catch (error: any) {
                if (error?.name === 'NotAllowedError') {
                    console.warn('⚠️ [VideoPlayer] Autoplay bloqueado');
                    setIsBlocked(true);
                    onPlaybackBlocked?.();
                }
            }
        };

        playVideo();

        // Cleanup: não parar o stream pois pode estar sendo usado em outro lugar
        return () => {
            // Apenas limpar srcObject se o componente for desmontado
            if (videoRef.current) {
                videoRef.current.srcObject = null;
            }
        };
    }, [stream, muted]); // ✅ Removed callbacks from deps to avoid loop

    // ✅ Handler para usuário clicar e desbloquear
    const handleClick = async () => {
        if (isBlocked && videoRef.current) {
            try {
                await videoRef.current.play();
                videoRef.current.muted = muted;
                setIsBlocked(false);
                onPlaybackResumed?.();
            } catch (error) {
                console.error('❌ [VideoPlayer] Falha ao reproduzir:', error);
            }
        }
    };

    return (
        <div className={`video-player-container ${className}`} onClick={handleClick} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={muted}
                style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {isBlocked && (
                <div className="video-blocked-overlay">
                    <span>Clique para ativar o vídeo</span>
                </div>
            )}
        </div>
    );
}

export default VideoPlayer;
