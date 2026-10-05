import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '4000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'optics_super_secure_jwt_secret_key_2026_ivors',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || 'optics_refresh_secret_key_2026_ivors',
    refreshExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  cors: {
    origin: process.env.CLIENT_URL || '*',
  },
  storage: {
    driver: process.env.STORAGE_DRIVER || 'local',
    localPath: process.env.STORAGE_LOCAL_PATH || './storage_uploads',
  },
  smtp: {
    host: process.env.SMTP_HOST || '75y3xsuwutwh.hkph.mail-manager-smtp.amazonaws.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.SMTP_FROM || '"Optics" <no-reply@ivors.in>',
  },
};

export default config;
