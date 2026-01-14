import { StorageAdapter } from './StorageAdapter';
import * as fs from 'fs/promises';
import * as path from 'path';

export class LocalFsAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string = './public/uploads') {
    this.basePath = basePath;
  }

  async upload(file: Buffer, filePath: string, metadata?: Record<string, any>): Promise<string> {
    const fullPath = path.join(this.basePath, filePath);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, file);

    return filePath;
  }

  async download(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.basePath, filePath);
    return await fs.readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.basePath, filePath);
    await fs.unlink(fullPath);
  }

  async exists(filePath: string): Promise<boolean> {
    const fullPath = path.join(this.basePath, filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(filePath: string): string {
    // Return relative URL for web access
    return `/uploads/${filePath}`;
  }
}
