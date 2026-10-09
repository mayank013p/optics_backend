import { Server, Socket } from 'socket.io';

let ioInstance: Server | null = null;

export const setupBoardSockets = (io: Server) => {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join Project / Board room
    socket.on('join_board', ({ boardId, user }) => {
      socket.join(`board:${boardId}`);
      socket.to(`board:${boardId}`).emit('user_joined_board', { user, socketId: socket.id });
    });

    // Leave Board room
    socket.on('leave_board', ({ boardId }) => {
      socket.leave(`board:${boardId}`);
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
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });
};

export const getIO = (): Server | null => ioInstance;

export const broadcastPermissionsUpdate = (data: {
  roleId?: string;
  roleName?: string;
  permissionCode?: string;
  enabled?: boolean;
  permissionCodes?: string[];
  matrix?: any;
}) => {
  if (ioInstance) {
    ioInstance.emit('permissions_matrix_sync', data);
  }
};

export const broadcastMemberRoleUpdate = (data: {
  userId: string;
  role: string;
  team?: string;
}) => {
  if (ioInstance) {
    ioInstance.emit('member_role_sync', data);
  }
};

export const broadcastDocCreated = (data: { doc: any; projectId: string }) => {
  if (ioInstance) {
    ioInstance.emit('doc_created_sync', data);
  }
};

export const broadcastDocUpdated = (data: { doc: any; projectId: string }) => {
  if (ioInstance) {
    ioInstance.emit('doc_updated_sync', data);
  }
};

export const broadcastDocDeleted = (data: { docId: string; projectId: string }) => {
  if (ioInstance) {
    ioInstance.emit('doc_deleted_sync', data);
  }
};
