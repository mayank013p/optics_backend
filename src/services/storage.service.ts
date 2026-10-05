import fs from 'fs';
import path from 'path';
import config from '../config';

export interface StorageUploadResult {
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface IStorageDriver {
  uploadFile(buffer: Buffer, fileName: string, mimeType: string): Promise<StorageUploadResult>;
  deleteFile(fileKey: string): Promise<void>;
  getFileUrl(fileKey: string): Promise<string>;
}

// Local Storage Driver for development
export class LocalStorageDriver implements IStorageDriver {
  private uploadDir: string;

  constructor(uploadDir = './storage_uploads') {
    this.uploadDir = path.resolve(uploadDir);
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(buffer: Buffer, fileName: string, mimeType: string): Promise<StorageUploadResult> {
    const uniqueKey = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${fileName.replace(/\s+/g, '_')}`;
    const filePath = path.join(this.uploadDir, uniqueKey);
    await fs.promises.writeFile(filePath, buffer);

    return {
      fileKey: uniqueKey,
      fileUrl: `/uploads/${uniqueKey}`,
      fileName,
      fileSize: buffer.length,
      mimeType,
    };
  }

  async deleteFile(fileKey: string): Promise<void> {
    const filePath = path.join(this.uploadDir, fileKey);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  async getFileUrl(fileKey: string): Promise<string> {
    return `/uploads/${fileKey}`;
  }
}

// Storage Factory for S3 / Cloudflare R2 / Local
export class StorageService {
  private driver: IStorageDriver;

  constructor() {
    this.driver = new LocalStorageDriver(config.storage.localPath);
  }

  public getDriver(): IStorageDriver {
    return this.driver;
  }
}

export const storageService = new StorageService();
