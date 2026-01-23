import { Server as SocketIOServer, Socket } from 'socket.io';
import { transcriptionService } from '../services/transcriptionService';

export class TranscriptionWebSocketHandler {
  private io: SocketIOServer;
  private activeConnections: Map<string, Set<Socket>> = new Map();
  
  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Escutar eventos do serviço de transcrição
    transcriptionService.on('transcription', (data) => {
      this.broadcastTranscription(data.roomName, data.segment);
    });
  }

  /**
   * Configurar handlers para um socket
   */
  handleConnection(socket: Socket): void {
    console.log(`🔗 Cliente conectado para transcrição: ${socket.id}`);

    // Join room para transcrição
    socket.on('join-transcription-room', async (data) => {
      try {
        const { roomName, participantId, consultationId } = data;
        
        if (!roomName || !participantId) {
          socket.emit('error', { message: 'roomName and participantId are required' });
          return;
        }

        // Adicionar socket à sala
        socket.join(`transcription-${roomName}`);
        
        // Registrar conexão ativa
        if (!this.activeConnections.has(roomName)) {
          this.activeConnections.set(roomName, new Set());
        }
        this.activeConnections.get(roomName)!.add(socket);

        // Iniciar transcrição se for o primeiro participante
        const roomConnections = this.activeConnections.get(roomName)!;
        if (roomConnections.size === 1) {
          await transcriptionService.startTranscription(roomName, consultationId);
        }

        socket.emit('transcription-joined', {
          roomName,
          participantId,
          message: 'Successfully joined transcription room'
        });

        console.log(`👤 ${participantId} entrou na sala de transcrição: ${roomName}`);

      } catch (error) {
        console.error('Erro ao entrar na sala de transcrição:', error);
        socket.emit('error', { 
          message: 'Failed to join transcription room',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Receber áudio para transcrição
    socket.on('audio-data', async (data) => {
      try {
        const { roomName, participantId, audioData, sampleRate, channels } = data;
        
        if (!roomName || !participantId || !audioData) {
          socket.emit('error', { message: 'Missing required audio data' });
          return;
        }

        // Converter base64 para buffer
        const audioBuffer = Buffer.from(audioData, 'base64');
        
        // Processar áudio
        await transcriptionService.processAudioChunk({
          data: audioBuffer,
          participantId,
          sampleRate: sampleRate || 16000,
          channels: channels || 1
        }, roomName);

      } catch (error) {
        console.error('Erro ao processar áudio:', error);
        socket.emit('error', { 
          message: 'Failed to process audio',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Deixar sala de transcrição
    socket.on('leave-transcription-room', async (data) => {
      try {
        const { roomName } = data;
        
        if (!roomName) {
          socket.emit('error', { message: 'roomName is required' });
          return;
        }

        await this.handleLeaveRoom(socket, roomName);

      } catch (error) {
        console.error('Erro ao sair da sala de transcrição:', error);
        socket.emit('error', { 
          message: 'Failed to leave transcription room',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Solicitar estatísticas
    socket.on('get-transcription-stats', async (data) => {
      try {
        const { roomName } = data;
        
        if (!roomName) {
          socket.emit('error', { message: 'roomName is required' });
          return;
        }

        const stats = await transcriptionService.getTranscriptionStats(roomName);
        socket.emit('transcription-stats', stats);

      } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        socket.emit('error', { 
          message: 'Failed to get transcription stats',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Controle manual de transcrição
    socket.on('start-transcription', async (data) => {
      try {
        const { roomName, consultationId } = data;
        
        if (!roomName || !consultationId) {
          socket.emit('error', { message: 'roomName and consultationId are required' });
          return;
        }

        await transcriptionService.startTranscription(roomName, consultationId);
        
        socket.emit('transcription-started', {
          roomName,
          consultationId,
          message: 'Transcription started successfully'
        });

      } catch (error) {
        console.error('Erro ao iniciar transcrição:', error);
        socket.emit('error', { 
          message: 'Failed to start transcription',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    socket.on('stop-transcription', async (data) => {
      try {
        const { roomName } = data;
        
        if (!roomName) {
          socket.emit('error', { message: 'roomName is required' });
          return;
        }

        await transcriptionService.stopTranscription(roomName);
        
        socket.emit('transcription-stopped', {
          roomName,
          message: 'Transcription stopped successfully'
        });

      } catch (error) {
        console.error('Erro ao parar transcrição:', error);
        socket.emit('error', { 
          message: 'Failed to stop transcription',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    });

    // Handler de desconexão
    socket.on('disconnect', () => {
      this.handleDisconnection(socket);
    });
  }

  /**
   * Broadcast de transcrição para todos os clientes da sala
   */
  private broadcastTranscription(roomName: string, segment: any): void {
    this.io.to(`transcription-${roomName}`).emit('transcription-segment', {
      roomName,
      segment
    });
  }

  /**
   * Lidar com saída da sala
   */
  private async handleLeaveRoom(socket: Socket, roomName: string): Promise<void> {
    socket.leave(`transcription-${roomName}`);
    
    // Remover da lista de conexões ativas
    const roomConnections = this.activeConnections.get(roomName);
    if (roomConnections) {
      roomConnections.delete(socket);
      
      // Se foi o último participante, parar transcrição
      if (roomConnections.size === 0) {
        await transcriptionService.stopTranscription(roomName);
        this.activeConnections.delete(roomName);
        console.log(`🛑 Transcrição parada para sala vazia: ${roomName}`);
      }
    }

    socket.emit('transcription-left', {
      roomName,
      message: 'Successfully left transcription room'
    });

    console.log(`👤 Cliente saiu da sala de transcrição: ${roomName}`);
  }

  /**
   * Lidar com desconexão do cliente
   */
  private handleDisconnection(socket: Socket): void {
    console.log(`❌ Cliente desconectado: ${socket.id}`);
    
    // Remover de todas as salas ativas
    for (const [roomName, connections] of this.activeConnections.entries()) {
      if (connections.has(socket)) {
        this.handleLeaveRoom(socket, roomName);
      }
    }
  }

  /**
   * Obter estatísticas do WebSocket
   */
  getStats(): any {
    const totalConnections = Array.from(this.activeConnections.values())
      .reduce((sum, connections) => sum + connections.size, 0);
    
    return {
      totalConnections,
      activeRooms: this.activeConnections.size,
      roomDetails: Array.from(this.activeConnections.entries()).map(([roomName, connections]) => ({
        roomName,
        connections: connections.size
      }))
    };
  }
}