import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface S3Config {
  region: string;
  bucketName: string;
  accessKeyId: string;
  secretAccessKey: string;
}

export interface UploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

export interface FileMetadata {
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  organizationId: string;
  category: 'receipts' | 'documents' | 'avatars' | 'temp';
}

export class S3Service {
  private client: S3Client;
  private bucketName: string;
  private region: string;

  constructor(config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    this.bucketName = config.bucketName;
    this.region = config.region;
  }

  /**
   * Generate a presigned URL for direct file upload from client
   */
  async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: contentType,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Generate a presigned URL for file download
   */
  async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return await getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Upload file directly from server (for processing)
   */
  async uploadFile(
    key: string,
    body: Buffer | string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<UploadResult> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });

      await this.client.send(command);

      // Build region-aware S3 URL
      const region = this.region || 'us-east-1';
      const host = region === 'us-east-1' ? 's3.amazonaws.com' : `s3.${region}.amazonaws.com`;
      const url = `https://${this.bucketName}.${host}/${encodeURIComponent(key)}`;
      
      return {
        success: true,
        key,
        url,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown upload error',
      };
    }
  }

  /**
   * Delete file from S3
   */
  async deleteFile(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (error) {
      console.error('S3 delete error:', error);
      return false;
    }
  }

  /**
   * Generate a unique key for file storage
   */
  static generateKey(metadata: FileMetadata): string {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    const extension = metadata.originalName.split('.').pop() || 'bin';
    
    return `${metadata.category}/${metadata.organizationId}/${metadata.userId}/${timestamp}_${randomId}.${extension}`;
  }

  /**
   * Get public URL for file (if bucket is public)
   */
  getPublicUrl(key: string): string {
    const host = this.region === 'us-east-1' ? 's3.amazonaws.com' : `s3.${this.region}.amazonaws.com`;
    return `https://${this.bucketName}.${host}/${encodeURIComponent(key)}`;
  }
}

// Factory function to create S3 service with environment variables
export function createS3Service(): S3Service {
  const bucketName = process.env.AWS_S3_BUCKET_NAME;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const region = process.env.AWS_REGION || 'us-east-1';

  if (!bucketName) {
    throw new Error('Missing required AWS S3 environment variable: AWS_S3_BUCKET_NAME');
  }
  if (!accessKeyId) {
    throw new Error('Missing required AWS S3 environment variable: AWS_ACCESS_KEY_ID');
  }
  if (!secretAccessKey) {
    throw new Error('Missing required AWS S3 environment variable: AWS_SECRET_ACCESS_KEY');
  }

  const config: S3Config = {
    region,
    bucketName,
    accessKeyId,
    secretAccessKey,
  };

  return new S3Service(config);
} 