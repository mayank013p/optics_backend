import { PrismaClient } from '@prisma/client';
import config from './index';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ||
  new PrismaClient({
    log: config.env === 'development' ? ['warn', 'error'] : ['error'],
  });

if (config.env !== 'production') {
  global.__prisma = prisma;
}

export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log('🗄️  [Database] Connected to PostgreSQL via Prisma');
  } catch (error) {
    console.error('❌ [Database] Connection failed:', error);
    process.exit(1);
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  await prisma.$disconnect();
  console.log('🗄️  [Database] Disconnected from PostgreSQL');
};

export default prisma;
