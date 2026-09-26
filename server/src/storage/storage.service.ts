import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlobServiceClient,
  ContainerClient,
} from '@azure/storage-blob';
import { randomUUID } from 'crypto';

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

import { StorageRepository } from './storage.repo';
import { RequestUser } from '../common/types/jwt-payload';
import { Role } from '../common/constants/roles';
import * as imageSize from 'image-size';

const sizeOf: any =
  (imageSize as any).default || imageSize;

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  private readonly uploadsRoot: string;

  private readonly allowedMimetypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
  ];

  private readonly maxBytes = 5 * 1024 * 1024;

  private s3Client: S3Client | null = null;

  private blobServiceClient: BlobServiceClient | null = null;

  private containerClient: ContainerClient | null = null;

  private containerName: string;

  constructor(
    private readonly storageRepo?: StorageRepository,
    private readonly configService?: ConfigService,
  ) {
    this.uploadsRoot = path.join(
      process.cwd(),
      'uploads',
    );

    this.ensureBaseFolders();

    this.containerName =
      this.configService?.get<string>(
        'AZURE_STORAGE_CONTAINER',
        'withdrawal-proofs',
      ) || 'withdrawal-proofs';

    const connectionString =
      this.configService?.get<string>(
        'AZURE_STORAGE_CONNECTION_STRING',
      ) ||
      process.env.AZURE_STORAGE_CONNECTION_STRING;

    if (connectionString) {
      try {
        this.blobServiceClient =
          BlobServiceClient.fromConnectionString(
            connectionString,
          );

        this.containerClient =
          this.blobServiceClient.getContainerClient(
            this.containerName,
          );
      } catch (e) {
        this.logger.warn(
          'Failed to initialize Azure Blob Service Client for proofs',
        );
      }
    }
  }

  // ============================================================
  // R2 CONFIGURATION
  // ============================================================

  private getR2Client(): S3Client | null {
    if (this.s3Client) {
      return this.s3Client;
    }

    const accountId =
      this.configService?.get<string>(
        'R2_ACCOUNT_ID',
      );

    const accessKeyId =
      this.configService?.get<string>(
        'R2_ACCESS_KEY_ID',
      );

    const secretAccessKey =
      this.configService?.get<string>(
        'R2_SECRET_ACCESS_KEY',
      );

    const endpoint =
      this.configService?.get<string>(
        'R2_ENDPOINT',
      );

    if (
      !accountId ||
      !accessKeyId ||
      !secretAccessKey
    ) {
      const envAccount =
        process.env.R2_ACCOUNT_ID;

      const envKey =
        process.env.R2_ACCESS_KEY_ID;

      const envSecret =
        process.env.R2_SECRET_ACCESS_KEY;

      const envEndpoint =
        process.env.R2_ENDPOINT;

      if (
        !envAccount ||
        !envKey ||
        !envSecret
      ) {
        return null;
      }

      const resolvedEndpoint =
        envEndpoint ||
        `https://${envAccount}.r2.cloudflarestorage.com`;

      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: resolvedEndpoint,
        credentials: {
          accessKeyId: envKey,
          secretAccessKey: envSecret,
        },
      });

      return this.s3Client;
    }

    const resolvedEndpoint =
      endpoint ||
      `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: resolvedEndpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.s3Client;
  }

  private getR2Bucket(): string {
    return (
      this.configService?.get<string>(
        'R2_BUCKET_NAME',
      ) ||
      process.env.R2_BUCKET_NAME ||
      'pravesh'
    );
  }

  private getR2PublicUrl(): string {
    return (
      this.configService?.get<string>(
        'R2_PUBLIC_URL',
      ) ||
      process.env.R2_PUBLIC_URL ||
      ''
    );
  }

  private buildR2PublicUrl(
    key: string,
  ): string {
    const publicUrl =
      this.getR2PublicUrl();

    if (publicUrl) {
      return `${publicUrl.replace(
        /\/$/,
        '',
      )}/${key}`;
    }

    const endpoint =
      this.configService?.get<string>(
        'R2_ENDPOINT',
      ) ||
      process.env.R2_ENDPOINT ||
      '';

    const bucket =
      this.getR2Bucket();

    if (endpoint) {
      return `${endpoint.replace(
        /\/$/,
        '',
      )}/${bucket}/${key}`;
    }

    return key;
  }

  // ============================================================
  // LOCAL STORAGE
  // ============================================================

  private ensureBaseFolders(): void {
    try {
      const categories = ['other'];

      for (const category of categories) {
        const dir = path.join(
          this.uploadsRoot,
          category,
        );

        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, {
            recursive: true,
          });
        }
      }
    } catch (e) {
      this.logger.warn(
        `Failed to ensure base upload folders: ${
          (e as Error).message
        }`,
      );
    }
  }

  private getUploadsRoot(): string {
    return this.uploadsRoot;
  }

  private localDir(
    subdir: string,
  ): string {
    return path.join(
      this.getUploadsRoot(),
      subdir,
    );
  }

  private ensureDir(
    dir: string,
  ): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, {
        recursive: true,
      });
    }
  }

  private safeJoin(
    ...segments: string[]
  ): string {
    const joined =
      path.join(...segments);

    const root =
      this.getUploadsRoot();

    const resolved =
      path.resolve(joined);

    const resolvedRoot =
      path.resolve(root);

    if (
      !resolved.startsWith(
        resolvedRoot + path.sep,
      ) &&
      resolved !== resolvedRoot
    ) {
      throw new BadRequestException(
        'Invalid path',
      );
    }

    return resolved;
  }

  // ============================================================
  // FILE VALIDATION
  // ============================================================

  private validateFile(
    file: Express.Multer.File,
  ): void {
    if (!file) {
      throw new BadRequestException(
        'File is required',
      );
    }

    if (
      !this.allowedMimetypes.includes(
        file.mimetype,
      )
    ) {
      throw new BadRequestException(
        `Invalid file type ${file.mimetype}. Allowed: jpg, jpeg, png, webp`,
      );
    }

    if (
      file.size > this.maxBytes
    ) {
      throw new BadRequestException(
        `File too large: ${file.size} bytes. Maximum 5 MB`,
      );
    }

    if (
      !file.buffer ||
      file.buffer.length === 0
    ) {
      throw new BadRequestException(
        'Empty file',
      );
    }
  }

  private getExtensionFromMimetype(
    mimetype: string,
  ): string {
    if (
      mimetype === 'image/jpeg' ||
      mimetype === 'image/jpg'
    ) {
      return 'jpg';
    }

    if (
      mimetype === 'image/png'
    ) {
      return 'png';
    }

    if (
      mimetype === 'image/webp'
    ) {
      return 'webp';
    }

    throw new BadRequestException(
      `Unsupported mimetype ${mimetype}`,
    );
  }

  private sanitizeId(
    id: string | number,
  ): string {
    const str =
      String(id).trim();

    if (
      str.includes('..') ||
      str.includes('/') ||
      str.includes('\\') ||
      str.includes('\0')
    ) {
      throw new BadRequestException(
        'Invalid ID',
      );
    }

    if (
      !/^[a-zA-Z0-9_-]+$/.test(str)
    ) {
      throw new BadRequestException(
        'Invalid ID format',
      );
    }

    return str;
  }

  // ============================================================
  // IMAGE DIMENSIONS
  // ============================================================

  private validateImageDimensions(
    buffer: Buffer,
    type: 'square' | 'rectangle',
  ): void {
    let dimensions: {
      width: number;
      height: number;
    };

    try {
      dimensions = sizeOf(buffer);
    } catch {
      throw new BadRequestException(
        'Invalid image file',
      );
    }

    const {
      width,
      height,
    } = dimensions;

    if (!width || !height) {
      throw new BadRequestException(
        'Invalid image dimensions',
      );
    }

    if (type === 'square') {
      const ratio =
        width / height;

      if (
        ratio < 0.9 ||
        ratio > 1.1
      ) {
        throw new BadRequestException(
          `Square poster must be 1:1 aspect ratio (got ${width}x${height}, ratio ${ratio.toFixed(
            2,
          )})`,
        );
      }
    }

    if (
      type === 'rectangle'
    ) {
      const ratio =
        width / height;

      if (width <= height) {
        throw new BadRequestException(
          `Rectangle poster must be landscape (width > height), got ${width}x${height}`,
        );
      }

      if (
        ratio < 1.5 ||
        ratio > 2.0
      ) {
        throw new BadRequestException(
          `Rectangle poster must be ~16:9 landscape (ratio 1.5-2.0), got ${ratio.toFixed(
            2,
          )} (${width}x${height})`,
        );
      }
    }
  }

  // ============================================================
  // R2 UPLOAD
  // ============================================================

  private async uploadToR2(
    buffer: Buffer,
    key: string,
    mimetype: string,
  ): Promise<string> {
    const client =
      this.getR2Client();

    const bucket =
      this.getR2Bucket();

    if (!client) {
      this.logger.warn(
        'R2 client not configured — returning mock URL for tests',
      );

      return (
        this.buildR2PublicUrl(key) ||
        `https://mock-r2.example.com/${key}`
      );
    }

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );

    return this.buildR2PublicUrl(
      key,
    );
  }

  private async deleteFromR2(
    key: string,
  ): Promise<void> {
    const client =
      this.getR2Client();

    const bucket =
      this.getR2Bucket();

    if (!client) {
      return;
    }

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      );
    } catch (e) {
      this.logger.warn(
        `Failed to delete R2 object ${key}: ${
          (e as Error).message
        }`,
      );
    }
  }

  private async deleteR2ByPrefix(
    eventId: string,
    prefix: string,
  ): Promise<void> {
    const exts = [
      'jpg',
      'jpeg',
      'png',
      'webp',
    ];

    for (const ext of exts) {
      const key = `events/${eventId}/${prefix}.${ext}`;

      await this.deleteFromR2(
        key,
      ).catch(() => {});
    }
  }

  // ============================================================
  // EVENT POSTERS
  // ============================================================

  async saveEventPosterSquare(
    file: Express.Multer.File,
    eventId: string | number,
  ): Promise<{
    url: string;
    key: string;
  }> {
    this.validateFile(file);

    this.validateImageDimensions(
      file.buffer,
      'square',
    );

    const safeId =
      this.sanitizeId(eventId);

    const ext =
      this.getExtensionFromMimetype(
        file.mimetype,
      );

    const key = `events/${safeId}/poster-square.${ext}`;

    await this.deleteR2ByPrefix(
      safeId,
      'poster-square',
    );

    const url =
      await this.uploadToR2(
        file.buffer,
        key,
        file.mimetype,
      );

    return {
      url,
      key,
    };
  }

  async saveEventPosterRectangle(
    file: Express.Multer.File,
    eventId: string | number,
  ): Promise<{
    url: string;
    key: string;
  }> {
    this.validateFile(file);

    this.validateImageDimensions(
      file.buffer,
      'rectangle',
    );

    const safeId =
      this.sanitizeId(eventId);

    const ext =
      this.getExtensionFromMimetype(
        file.mimetype,
      );

    const key = `events/${safeId}/poster-rectangle.${ext}`;

    await this.deleteR2ByPrefix(
      safeId,
      'poster-rectangle',
    );

    const url =
      await this.uploadToR2(
        file.buffer,
        key,
        file.mimetype,
      );

    return {
      url,
      key,
    };
  }

  // ============================================================
  // AZURE STORAGE
  // ============================================================

  private async ensureContainer(): Promise<ContainerClient> {
    if (!this.containerClient) {
      throw new Error(
        'Azure Storage not configured: AZURE_STORAGE_CONNECTION_STRING missing',
      );
    }

    await this.containerClient.createIfNotExists(
      {
        access: 'blob',
      },
    );

    return this.containerClient;
  }

  // ============================================================
  // WITHDRAWAL PROOF UPLOAD
  // ============================================================

  async uploadProof(
    file: Express.Multer.File,
    withdrawalId: string,
  ): Promise<{
    url: string;
    key: string;
  }> {
    if (!file) {
      throw new BadRequestException(
        'File is required',
      );
    }

    const sanitized =
      file.originalname.replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );

    const filename = `${withdrawalId}-${randomUUID()}-${sanitized}`;

    // Azure Blob Storage
    if (this.containerClient) {
      const container =
        await this.ensureContainer();

      const blobName =
        `proofs/${filename}`;

      const blockBlobClient =
        container.getBlockBlobClient(
          blobName,
        );

      await blockBlobClient.uploadData(
        file.buffer,
        {
          blobHTTPHeaders: {
            blobContentType:
              file.mimetype,
          },
        },
      );

      return {
        url: blockBlobClient.url,
        key: blobName,
      };
    }

    // Local storage fallback
    const dir =
      this.localDir('proofs');

    await fsp.mkdir(dir, {
      recursive: true,
    });

    await fsp.writeFile(
      path.join(dir, filename),
      file.buffer,
    );

    return {
      url: `local://proofs/${filename}`,
      key: filename,
    };
  }

  // ============================================================
  // READ LOCAL FILE
  // ============================================================

  async readLocalFile(
    url: string,
  ): Promise<{
    buffer: Buffer;
    mimetype: string;
  }> {
    const prefix =
      'local://proofs/';

    if (!url.startsWith(prefix)) {
      throw new Error(
        'Not a local storage URL',
      );
    }

    const filename =
      path.basename(
        url.slice(prefix.length),
      );

    if (!filename) {
      throw new Error(
        'Invalid storage URL',
      );
    }

    const buffer =
      await fsp.readFile(
        path.join(
          this.localDir('proofs'),
          filename,
        ),
      );

    const ext =
      path
        .extname(filename)
        .toLowerCase();

    let mimetype =
      'image/jpeg';

    if (ext === '.png') {
      mimetype = 'image/png';
    } else if (
      ext === '.webp'
    ) {
      mimetype = 'image/webp';
    }

    return {
      buffer,
      mimetype,
    };
  }

  // ============================================================
  // DELETE LOCAL FILE
  // ============================================================

  async delete(
    key: string,
  ): Promise<void> {
    if (!key) {
      return;
    }

    try {
      const clean =
        key.replace(/^\/+/, '');

      const absolute =
        path.join(
          process.cwd(),
          clean,
        );

      const resolved =
        path.resolve(absolute);

      const root =
        path.resolve(
          this.getUploadsRoot(),
        );

      if (
        !resolved.startsWith(
          root + path.sep,
        ) &&
        resolved !== root
      ) {
        return;
      }

      if (
        fs.existsSync(resolved)
      ) {
        fs.unlinkSync(resolved);
      }
    } catch (e) {
      this.logger.warn(
        `Failed to delete local file ${key}: ${
          (e as Error).message
        }`,
      );
    }
  }

  // ============================================================
  // DELETE BY URL
  // ============================================================

  async deleteByUrl(
    url: string,
  ): Promise<void> {
    if (!url) {
      return;
    }

    if (
      url.startsWith('http://') ||
      url.startsWith('https://')
    ) {
      const idx =
        url.indexOf(
          '/uploads/',
        );

      if (idx !== -1) {
        const localPart =
          url.substring(idx);

        await this.delete(
          localPart,
        );
      }

      return;
    }

    await this.delete(url);
  }

  // ============================================================
  // ABSOLUTE PATH
  // ============================================================

  getAbsolutePath(
    relativeUrl: string,
  ): string {
    const clean =
      relativeUrl.replace(
        /^\/+/,
        '',
      );

    return path.join(
      process.cwd(),
      clean,
    );
  }

  // ============================================================
  // R2 URL HELPERS
  // ============================================================

  private extractR2KeyFromUrl(
    url: string,
  ): string | null {
    try {
      const publicUrl =
        this.getR2PublicUrl();

      if (
        publicUrl &&
        url.startsWith(publicUrl)
      ) {
        const key =
          url
            .substring(
              publicUrl.length,
            )
            .replace(/^\/+/, '');

        return key || null;
      }

      const idx =
        url.indexOf('events/');

      if (idx !== -1) {
        const key =
          url
            .substring(idx)
            .split('?')[0];

        return key || null;
      }

      if (
        url.startsWith(
          'events/',
        )
      ) {
        return url;
      }

      return null;
    } catch {
      return null;
    }
  }

  private async deleteR2ByUrl(
    url: string,
  ): Promise<void> {
    const key =
      this.extractR2KeyFromUrl(
        url,
      );

    if (key) {
      await this.deleteFromR2(
        key,
      ).catch(() => {});
    }
  }

  // ============================================================
  // GENERIC LOCAL UPLOAD
  // ============================================================

  async upload(
    file: Express.Multer.File,
    dirPath?: string,
  ): Promise<{
    url: string;
    key: string;
  }> {
    this.validateFile(file);

    const ext =
      this.getExtensionFromMimetype(
        file.mimetype,
      );

    const safeDir = dirPath
      ? dirPath
          .replace(/\.\./g, '')
          .replace(/^\/+/, '')
      : 'other';

    const dir =
      this.safeJoin(
        this.getUploadsRoot(),
        safeDir,
      );

    this.ensureDir(dir);

    const filename =
      `file_${Date.now()}.${ext}`;

    const fullPath =
      this.safeJoin(
        dir,
        filename,
      );

    fs.writeFileSync(
      fullPath,
      file.buffer,
    );

    const relativeUrl =
      `/uploads/${safeDir}/${filename}`;

    return {
      url: relativeUrl,
      key: relativeUrl,
    };
  }

  // ============================================================
  // EVENT POSTER HANDLERS
  // ============================================================




  // ============================================================
  // EVENT POSTER HANDLERS
  // ============================================================

  async handleEventPosterGenericUpload(
    file: Express.Multer.File,
    eventId: string | number,
    user: RequestUser,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    const numericEventId = Number(eventId);
    if (!Number.isInteger(numericEventId)) {
      throw new BadRequestException('Invalid event ID');
    }
    if (!this.storageRepo) {
      throw new BadRequestException('Storage repository not configured');
    }
    const event = await this.storageRepo.findEventById(numericEventId);
    if (!event) {
      throw new NotFoundException('Event not found');
    }
    const userId = user.userId || user.id;
    if (user.role !== Role.ORGANIZER && user.role !== Role.ADMIN) {
      throw new ForbiddenException('Only organizer or admin can upload posters');
    }
    if (user.role === Role.ORGANIZER) {
      const organizer = await this.storageRepo.findOrganizerByUserId(userId);
      if (!organizer || event.organizerId !== organizer.id) {
        throw new ForbiddenException('You do not own this event');
      }
    }
    
    // Upload generic poster using posterUrl field
    const ext = this.getExtensionFromMimetype(file.mimetype);
    const key = `events/${numericEventId}/poster.${ext}`;
    const url = await this.uploadToR2(file.buffer, key, file.mimetype);
    
    const oldUrl = event.posterUrl;
    const updated = await this.storageRepo.updateEventPoster(numericEventId, url);
    
    if (oldUrl && oldUrl !== url) {
      await this.deleteR2ByUrl(oldUrl).catch(() => {});
    }
    
    return {
      message: 'Event poster uploaded successfully',
      posterUrl: updated.posterUrl,
    };
  }

  async handleEventPosterUpload(
    file: Express.Multer.File,
    eventId: string | number,
    user: RequestUser,
  ) {
    return this.handleEventPosterGenericUpload(file, eventId, user);
  }
}
