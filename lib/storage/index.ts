import { StorageAdapter, StorageConfig } from './StorageAdapter';
import { LocalFsAdapter } from './LocalFsAdapter';
import { S3Adapter } from './S3Adapter';

export function createStorageAdapter(config?: StorageConfig): StorageAdapter {
  const storageType = config?.type || process.env.STORAGE_TYPE || 'local';

  if (storageType === 's3') {
    const bucket = config?.bucket || process.env.AWS_S3_BUCKET;
    const region = config?.region || process.env.AWS_REGION || 'us-east-1';

    if (!bucket) {
      throw new Error('S3 bucket not configured');
    }

    return new S3Adapter(bucket, region);
  }

  // Default to local file system
  const basePath = config?.basePath || './public/uploads';
  return new LocalFsAdapter(basePath);
}

export * from './StorageAdapter';
export * from './LocalFsAdapter';
export * from './S3Adapter';
