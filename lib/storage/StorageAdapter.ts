// Storage Adapter Interface
export interface StorageAdapter {
  upload(file: Buffer, path: string, metadata?: Record<string, any>): Promise<string>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  getUrl(path: string): string;
}

export type StorageConfig = {
  type: 'local' | 's3';
  basePath?: string;
  bucket?: string;
  region?: string;
};
