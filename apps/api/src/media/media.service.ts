import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';
import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { loadEnv } from '@slay/config';

const env = loadEnv();

const IMAGE_TYPES = new Map<string, string>([
  ['image/jpeg', 'jpg'],
  ['image/jpg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
  ['image/avif', 'avif'],
  ['image/gif', 'gif'],
]);
const VIDEO_TYPES = new Map<string, string>([
  ['video/mp4', 'mp4'],
  ['video/webm', 'webm'],
]);

function acceptedTypes(): Map<string, string> {
  return env.MEDIA_ALLOW_VIDEO
    ? new Map([...IMAGE_TYPES, ...VIDEO_TYPES])
    : IMAGE_TYPES;
}

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
          // Supabase / MinIO / R2 need path-style addressing.
          forcePathStyle: env.S3_FORCE_PATH_STYLE || this.isSupabase(),
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID!,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY!,
          },
        })
      : null;

    this.logger.log(
      `Media storage driver: ${this.driver}${this.driver === 's3' ? ` (${this.publicBaseUrl()})` : ''}`,
    );
    if (this.driver === 'local' && env.NODE_ENV === 'production') {
      this.logger.warn(
        'Media is on the LOCAL DISK in production — uploads will NOT survive a redeploy. Configure S3/Supabase storage.',
      );
    }
    if (this.driver === 's3' && !env.S3_ENDPOINT) {
      this.logger.warn(
        'S3 driver is active but S3_ENDPOINT is NOT set — the client will target AWS S3 directly and uploads will FAIL if the credentials belong to Supabase/another S3-compatible provider. Set S3_ENDPOINT to your storage endpoint.',
      );
    }
  }

  /** true when the s3 driver has everything it needs (or the driver is local). */
  private get endpointConfigured(): boolean {
    return this.driver !== 's3' || Boolean(env.S3_ENDPOINT || env.S3_PUBLIC_BASE_URL);
  }

  config() {
    return {
      driver: this.driver,
      persistent: this.driver === 's3',
      endpointConfigured: this.endpointConfigured,
      provider:
        this.driver !== 's3'
          ? 'local-disk'
          : this.isSupabase()
            ? 'supabase'
            : env.S3_ENDPOINT
              ? 's3-compatible'
              : 'aws-s3',
      maxMb: env.MEDIA_MAX_MB,
      allowVideo: env.MEDIA_ALLOW_VIDEO,
      acceptedTypes: [...acceptedTypes().keys()],
      publicBaseUrl: this.publicBaseUrl(),
    };
  }

  private isSupabase(): boolean {
    return /\bsupabase\.(co|in|net)\b/.test(env.S3_ENDPOINT ?? '');
  }

  /** Supabase S3 endpoint -> its public object URL for the bucket. */
  private supabasePublicBase(): string | null {
    const m = (env.S3_ENDPOINT ?? '').match(
      /^https?:\/\/([a-z0-9-]+)\.(?:storage\.)?supabase\.(?:co|in|net)/i,
    );
    if (!m) return null;
    return `https://${m[1]}.supabase.co/storage/v1/object/public/${env.S3_BUCKET}`;
  }

  publicBaseUrl(): string {
    if (this.driver === 'local') return `${env.API_URL}/uploads`;
    if (env.S3_PUBLIC_BASE_URL) return env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
    const supa = this.supabasePublicBase();
    if (supa) return supa;
    if (env.S3_ENDPOINT) {
      return `${env.S3_ENDPOINT.replace(/\/$/, '')}/${env.S3_BUCKET}`;
    }
    return `https://${env.S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com`;
  }

  private validate(contentType: string, size: number): string {
    const ext = acceptedTypes().get(contentType);
    if (!ext) {
      throw new BadRequestException(
        `Unsupported file type "${contentType}". Allowed: ${[...acceptedTypes().keys()].join(', ')}`,
      );
    }
    if (size > env.MEDIA_MAX_MB * 1024 * 1024) {
      throw new BadRequestException(`File exceeds the ${env.MEDIA_MAX_MB} MB limit`);
    }
    return ext;
  }

  private buildKey(folder: string, ext: string): string {
    const safeFolder = /^[a-z0-9_-]+$/i.test(folder) ? folder : 'products';
    const now = new Date();
    const yyyymm = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
    // Filename is a random UUID — the client's original name is never trusted.
    return `${safeFolder}/${yyyymm}/${randomUUID()}.${ext}`;
  }

  /** Store an uploaded file (S3/Supabase or local disk) and return its public URL. */
  async store(
    file: { buffer: Buffer; mimetype: string; size: number; originalname?: string },
    folder = 'products',
  ): Promise<UploadedMedia> {
    const ext = this.validate(file.mimetype, file.size); // throws for unknown type / oversize
    const key = this.buildKey(folder, ext);

    if (this.driver === 's3' && this.s3) {
      if (!this.endpointConfigured) {
        this.logger.error(
          'Image upload rejected: S3 driver active but S3_ENDPOINT / S3_PUBLIC_BASE_URL is unset.',
        );
        throw new ServiceUnavailableException(
          'Image storage is not fully configured on the server (missing storage endpoint). Please contact the administrator.',
        );
      }
      try {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: env.S3_BUCKET,
            Key: key,
            Body: file.buffer,
            ContentType: file.mimetype,
            CacheControl: 'public, max-age=31536000, immutable',
          }),
        );
      } catch (err) {
        // Never leak credentials/endpoints — log the error name only.
        this.logger.error(
          `S3 PutObject failed (${(err as Error).name}): ${(err as Error).message.slice(0, 200)}`,
        );
        throw new ServiceUnavailableException(
          'Could not save the image to storage. Check the storage credentials / endpoint and try again.',
        );
      }
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

  /** Storage key for a URL this service produced (or null if it isn't ours). */
  keyFromUrl(url: string): string | null {
    if (!url) return null;
    const base = `${this.publicBaseUrl()}/`;
    if (url.startsWith(base)) return decodeURIComponent(url.slice(base.length));
    // Also accept a bare key.
    if (/^[a-z0-9_-]+\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(url)) return url;
    return null;
  }

  /**
   * Best-effort delete of an object we own. Used when an admin removes an image
   * from a product form before/after saving, so the bucket doesn't accumulate
   * orphans. Never throws — a missing object is fine.
   */
  async delete(urlOrKey: string): Promise<{ deleted: boolean; key: string | null }> {
    const key = this.keyFromUrl(urlOrKey);
    if (!key) return { deleted: false, key: null };
    try {
      if (this.driver === 's3' && this.s3) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
      } else {
        await rm(join(process.cwd(), env.MEDIA_UPLOAD_DIR, key), { force: true });
      }
      return { deleted: true, key };
    } catch (err) {
      this.logger.warn(`Media delete failed for ${key}: ${(err as Error).message}`);
      return { deleted: false, key };
    }
  }

  /**
   * Presigned PUT URL for direct browser -> S3 uploads (skips the API for large
   * files). Only available when the S3 driver is active.
   */
  async presignUpload(input: { filename: string; contentType: string; folder?: string }) {
    if (this.driver !== 's3' || !this.s3) {
      throw new BadRequestException('S3 is not configured; use POST /admin/media/upload instead');
    }
    const ext =
      acceptedTypes().get(input.contentType) ?? (extname(input.filename).slice(1) || 'bin');
    if (!acceptedTypes().get(input.contentType)) {
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
