import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '@slay/config';

const env = loadEnv();

const ACCEPTED = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
]);

export interface UploadedMedia {
  url: string;
  key: string;
  contentType: string;
  size: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client | null;
  readonly driver: 's3' | 'local';

  constructor() {
    const s3Ready = Boolean(
      env.S3_BUCKET && env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY,
    );
    this.driver = s3Ready ? 's3' : 'local';
    this.s3 = s3Ready
      ? new S3Client({
          region: env.AWS_REGION,
          endpoint: env.S3_ENDPOINT,
          forcePathStyle: env.S3_FORCE_PATH_STYLE,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
          },
        })
      : null;

    this.logger.log(`Media storage driver: ${this.driver}`);
  }

  config() {
    return {
      driver: this.driver,
      maxMb: env.MEDIA_MAX_MB,
      acceptedTypes: [...ACCEPTED.keys()],
      publicBaseUrl: this.publicBaseUrl(),
    };
  }

  private publicBaseUrl(): string {
    if (this.driver === 'local') return `${env.API_URL}/uploads`;
    if (env.S3_PUBLIC_BASE_URL) return env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
    if (env.S3_ENDPOINT) {
      return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}`;
    }
    return `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
  }

  private validate(contentType: string, size: number): string {
    const ext = ACCEPTED.get(contentType);
    if (!ext) {
      throw new BadRequestException(
        `Unsupported file type "${contentType}". Allowed: ${[...ACCEPTED.keys()].join(', ')}`,
      );
    }
    if (size > env.MEDIA_MAX_MB * 1024 * 1024) {
      throw new BadRequestException(`File exceeds ${env.MEDIA_MAX_MB} MB limit`);
    }
    return ext;
  }

  private buildKey(folder: string, ext: string): string {
    const now = new Date();
    const yyyymm = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    return `${folder}/${yyyymm}/${randomUUID()}.${ext}`;
  }

  /** Store an uploaded file (S3 or local disk) and return its public URL. */
  async store(
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
    folder = 'products',
  ): Promise<UploadedMedia> {
    const ext = this.validate(file.mimetype, file.size); // throws for unknown type / oversize
    const key = this.buildKey(folder, ext);

    if (this.driver === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: env.S3_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
    } else {
      const dir = join(process.cwd(), env.MEDIA_UPLOAD_DIR, ...key.split('/').slice(0, -1));
      await mkdir(dir, { recursive: true });
      await writeFile(join(process.cwd(), env.MEDIA_UPLOAD_DIR, key), file.buffer);
    }

    return {
      url: `${this.publicBaseUrl()}/${key}`,
      key,
      contentType: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Presigned PUT URL for direct browser -> S3 uploads (skips the API for large
   * files). Only available when the S3 driver is active.
   */
  async presignUpload(input: { filename: string; contentType: string; folder?: string }) {
    if (this.driver !== 's3' || !this.s3) {
      throw new BadRequestException('S3 is not configured; use POST /admin/media/upload instead');
    }
    const ext = ACCEPTED.get(input.contentType) ?? (extname(input.filename).slice(1) || 'bin');
    if (!ACCEPTED.get(input.contentType)) {
      throw new BadRequestException(`Unsupported file type "${input.contentType}"`);
    }
    const key = this.buildKey(input.folder ?? 'products', ext);
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ContentType: input.contentType,
      }),
      { expiresIn: 600 },
    );
    return {
      method: 'PUT' as const,
      uploadUrl,
      headers: { 'Content-Type': input.contentType },
      key,
      publicUrl: `${this.publicBaseUrl()}/${key}`,
      expiresInSeconds: 600,
    };
  }
}
