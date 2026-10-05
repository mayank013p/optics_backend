import { Server, Socket } from 'socket.io';
import { logger } from '../utils/logger';

export const setupBoardSockets = (io: Server) => {
  io.on('connection', (socket: Socket) => {
    logger.info(`[Socket.io] Client connected: ${socket.id}`);

    // Join Project / Board room
    socket.on('join_board', ({ boardId, user }) => {
      socket.join(`board:${boardId}`);
      logger.info(`User ${user?.name || socket.id} joined board:${boardId}`);
      socket.to(`board:${boardId}`).emit('user_joined_board', { user, socketId: socket.id });
    });

    // Leave Board room
    socket.on('leave_board', ({ boardId }) => {
      socket.leave(`board:${boardId}`);
      logger.info(`Socket ${socket.id} left board:${boardId}`);
    });

    // Broadcast issue moved (optimistic realtime update)
    socket.on('issue_moved', ({ boardId, issueId, sourceColumnId, destinationColumnId, newPosition, user }) => {
      socket.to(`board:${boardId}`).emit('issue_moved_sync', {
        issueId,
        sourceColumnId,
        destinationColumnId,
        newPosition,
        movedBy: user,
        timestamp: new Date().toISOString(),
      });
    });

    // Broadcast new issue created
    socket.on('issue_created', ({ boardId, issue }) => {
      socket.to(`board:${boardId}`).emit('issue_created_sync', { issue });
    });

    // Live cursor / active user typing
    socket.on('user_activity', ({ boardId, user, action }) => {
      socket.to(`board:${boardId}`).emit('user_activity_sync', { user, action });
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};
