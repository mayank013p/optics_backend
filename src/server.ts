import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.routes';
import orgRoutes from './routes/org.routes';
import workspaceRoutes from './routes/workspace.routes';
import projectRoutes from './routes/project.routes';
import boardRoutes from './routes/board.routes';
import taskRoutes from './routes/task.routes';
import docRoutes from './routes/doc.routes';
import activityRoutes from './routes/activity.routes';
import statsRoutes from './routes/stats.routes';
import storageRoutes from './routes/storage.routes';
import teamRoutes from './routes/team.routes';
import { setupBoardSockets } from './sockets/boardSocket';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Setup Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  },
});

setupBoardSockets(io);

import { errorHandler } from './middlewares/error.middleware';

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static uploads for local file storage
const uploadDir = path.resolve(process.env.STORAGE_LOCAL_PATH || './storage_uploads');
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', product: 'Optics by Ivors', timestamp: new Date().toISOString() });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', orgRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/boards', boardRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/issues', taskRoutes); // Backward-compatible alias
app.use('/api/docs', docRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/files', storageRoutes);
app.use('/api/teams', teamRoutes);

// Error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 [Optics API] Server running on http://localhost:${PORT}`);
  console.log(`⚡ [Optics Real-time] WebSockets initialized`);
});

export default app;

