import express from 'express';
import { Request, Response } from 'express';
import { rooms, userToRoom, socketToRoom } from '../websocket/rooms';
import { db } from '../config/database';

const router = express.Router();

// Referência para o Socket.IO (será setada pelo server.ts)
let socketIO: any = null;

export function setSocketIO(io: any) {
  socketIO = io;
}

// Health check para rotas de salas
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'rooms-api',
    timestamp: new Date().toISOString()
  });
});

// Endpoint para criar sala (usado pelo frontend React)
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { hostName, roomName, patientId, patientName, patientEmail, patientPhone } = req.body;

    if (!hostName || !roomName) {
      return res.status(400).json({
        success: false,
        error: 'Nome do host e nome da sala são obrigatórios'
      });
    }

    // TODO: Integrar com sistema de salas via Socket.IO
    // Por enquanto, retornar sucesso para integração
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    res.json({
      success: true,
      roomId: roomId,
      roomName: roomName,
      hostName: hostName,
      patientId: patientId,
      patientName: patientName,
      message: 'Sala criada com sucesso'
    });

  } catch (error) {
    console.error('Erro ao criar sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// Endpoint para obter informações da sala
router.get('/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    // Buscar sala no mapa de salas
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou expirada'
      });
    }

    res.json({
      success: true,
      roomId: roomId,
      roomData: {
        roomName: room.roomName,
        status: room.status,
        createdAt: room.createdAt,
        hostUserName: room.hostUserName,
        participantUserName: room.participantUserName,
        transcriptionsCount: room.transcriptions?.length || 0
      },
      message: 'Informações da sala obtidas'
    });

  } catch (error) {
    console.error('Erro ao obter sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ✅ NOVO: Endpoint para recuperar histórico de transcrições de uma sala
router.get('/:roomId/transcriptions', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    console.log(`📝 [API] Solicitação de histórico de transcrições para sala: ${roomId}`);

    // Buscar sala no mapa de salas
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou expirada'
      });
    }

    // Retornar histórico de transcrições
    res.json({
      success: true,
      roomId: roomId,
      transcriptions: room.transcriptions || [],
      count: room.transcriptions?.length || 0,
      roomStatus: room.status
    });

    console.log(`✅ [API] Retornado ${room.transcriptions?.length || 0} transcrições para sala ${roomId}`);

  } catch (error) {
    console.error('❌ [API] Erro ao obter transcrições da sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

// ==================== ENDPOINTS ADMIN ====================

/**
 * GET /api/rooms/admin/active
 * Lista todas as salas ativas com status de conexão WebRTC
 * Usado pelo painel administrativo
 */
router.get('/admin/active', async (req: Request, res: Response) => {
  try {
    console.log(`🔍 [ADMIN] Listando salas ativas...`);

    const activeRooms: any[] = [];

    // Iterar sobre todas as salas em memória
    rooms.forEach((room: any, roomId: string) => {
      // Verificar se a conexão WebRTC está ativa
      const hasHost = room.hostSocketId !== null;
      const hasParticipant = room.participantSocketId !== null;
      const hasOffer = room.offer !== null;
      const hasAnswer = room.answer !== null;
      const webrtcActive = hasHost && hasParticipant && hasOffer && hasAnswer;

      activeRooms.push({
        roomId,
        roomName: room.roomName,
        status: room.status,
        webrtc_active: webrtcActive,
        host: {
          userName: room.hostUserName,
          connected: hasHost,
        },
        participant: {
          userName: room.participantUserName,
          connected: hasParticipant,
        },
        hasOffer,
        hasAnswer,
        createdAt: room.createdAt,
        lastActivity: room.lastActivity,
        consultationId: room.consultationId || null,
        callSessionId: room.callSessionId || null,
        patientName: room.patientName,
        patientId: room.patientId,
        transcriptionsCount: room.transcriptions?.length || 0,
      });
    });

    console.log(`✅ [ADMIN] ${activeRooms.length} salas encontradas em memória`);

    res.json({
      success: true,
      rooms: activeRooms,
      total: activeRooms.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao listar salas ativas:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

/**
 * POST /api/rooms/admin/terminate/:roomId
 * Encerra uma chamada/sala remotamente (admin)
 */
router.post('/admin/terminate/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params as { roomId: string };
    const { reason } = req.body;

    console.log(`🛑 [ADMIN] Solicitação de encerramento remoto da sala: ${roomId}`);
    console.log(`📝 [ADMIN] Motivo: ${reason || 'Não informado'}`);

    // Buscar sala no mapa de salas
    const room = rooms.get(roomId);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Sala não encontrada ou já foi encerrada'
      });
    }

    // Notificar participantes que a sala foi encerrada pelo admin
    const terminationMessage = {
      roomId: roomId,
      message: 'A sala foi encerrada pelo administrador',
      reason: reason || 'Encerramento administrativo',
      timestamp: new Date().toISOString(),
    };

    // Usar socketIO para notificar os participantes (se disponível)
    let notificationsSent = 0;
    try {
      console.log(`🔍 [ADMIN] Verificando Socket.IO:`, {
        socketIOExists: !!socketIO,
        hostSocketId: room.hostSocketId,
        participantSocketId: room.participantSocketId,
        hostUserName: room.hostUserName,
        participantUserName: room.participantUserName,
      });

      if (socketIO) {
        if (room.hostSocketId) {
          socketIO.to(room.hostSocketId).emit('roomTerminatedByAdmin', terminationMessage);
          console.log(`📤 [ADMIN] Notificação enviada ao host: ${room.hostUserName} (socket: ${room.hostSocketId})`);
          notificationsSent++;
        }
        if (room.participantSocketId) {
          socketIO.to(room.participantSocketId).emit('roomTerminatedByAdmin', terminationMessage);
          console.log(`📤 [ADMIN] Notificação enviada ao participante: ${room.participantUserName} (socket: ${room.participantSocketId})`);
          notificationsSent++;
        }

        // Também emitir para a sala inteira como fallback
        socketIO.to(roomId).emit('roomTerminatedByAdmin', terminationMessage);
        console.log(`📤 [ADMIN] Notificação enviada para a sala: ${roomId}`);
      } else {
        console.log(`⚠️ [ADMIN] Socket.IO não disponível para notificações`);
      }
    } catch (ioError) {
      console.error('⚠️ [ADMIN] Erro ao notificar participantes:', ioError);
    }

    console.log(`📊 [ADMIN] Total de notificações enviadas: ${notificationsSent}`);

    // Atualizar banco de dados
    try {
      // Atualizar call_session
      await db.updateCallSession(roomId, {
        status: 'ended',
        ended_at: new Date().toISOString(),
        webrtc_active: false,
        metadata: {
          terminatedBy: 'admin',
          terminationReason: reason || 'Encerramento administrativo',
          terminatedAt: new Date().toISOString(),
        }
      });

      // Atualizar status da consulta se existir
      if (room.consultationId) {
        await db.updateConsultation(room.consultationId, {
          status: 'CANCELLED',
          notes: `Encerrado pelo administrador: ${reason || 'Encerramento administrativo'}`,
        });
      }
    } catch (dbError) {
      console.error('⚠️ [ADMIN] Erro ao atualizar banco:', dbError);
    }

    // Limpar mapeamentos
    if (room.hostUserName) userToRoom.delete(room.hostUserName);
    if (room.participantUserName) userToRoom.delete(room.participantUserName);
    if (room.hostSocketId) socketToRoom.delete(room.hostSocketId);
    if (room.participantSocketId) socketToRoom.delete(room.participantSocketId);

    // Remover sala do mapa
    rooms.delete(roomId);

    console.log(`✅ [ADMIN] Sala ${roomId} encerrada com sucesso`);

    res.json({
      success: true,
      message: 'Sala encerrada com sucesso',
      roomId: roomId,
      terminatedAt: new Date().toISOString(),
    });

  } catch (error) {
    console.error('❌ [ADMIN] Erro ao encerrar sala:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
});

export default router;
