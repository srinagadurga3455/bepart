import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
<<<<<<< HEAD
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
=======
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { StorageRepository } from './storage.repo';
import { RequestUser } from '../common/types/jwt-payload';
import { Role } from '../common/constants/roles';
// image-size is CJS, handle both default and named import
import * as imageSize from 'image-size';
const sizeOf: any = (imageSize as any).default || imageSize;
>>>>>>> 5a81ff9 (feat: complete event registration payment and R2 storage flow)

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadsRoot: string;
  private readonly allowedMimetypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  private readonly allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
  private readonly maxBytes = 5 * 1024 * 1024;
  private s3Client: S3Client | null = null;

  constructor(
    private readonly storageRepo?: StorageRepository,
    private readonly configService?: ConfigService,
  ) {
    // server/uploads relative to process.cwd() which is server folder in dev/prod
    this.uploadsRoot = path.join(process.cwd(), 'uploads');
    // Ensure base folders exist (events, organizers, users, other) lazily
    this.ensureBaseFolders();
  }

  private getR2Client(): S3Client | null {
    if (this.s3Client) return this.s3Client;
    const accountId = this.configService?.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.configService?.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.configService?.get<string>('R2_SECRET_ACCESS_KEY');
    const endpoint = this.configService?.get<string>('R2_ENDPOINT');
    // If no R2 config, return null (will be mocked in tests)
    if (!accountId || !accessKeyId || !secretAccessKey) {
      // Fallback to env directly for tests without ConfigService
      const envAccount = process.env.R2_ACCOUNT_ID;
      const envKey = process.env.R2_ACCESS_KEY_ID;
      const envSecret = process.env.R2_SECRET_ACCESS_KEY;
      const envEndpoint = process.env.R2_ENDPOINT;
      if (!envAccount || !envKey || !envSecret) return null;
      const resolvedEndpoint = envEndpoint || `https://${envAccount}.r2.cloudflarestorage.com`;
      this.s3Client = new S3Client({
        region: 'auto',
        endpoint: resolvedEndpoint,
        credentials: { accessKeyId: envKey, secretAccessKey: envSecret },
      });
      return this.s3Client;
    }
    const resolvedEndpoint = endpoint || `https://${accountId}.r2.cloudflarestorage.com`;
    this.s3Client = new S3Client({
      region: 'auto',
      endpoint: resolvedEndpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    return this.s3Client;
  }

  private getR2Bucket(): string {
    return this.configService?.get<string>('R2_BUCKET_NAME') || process.env.R2_BUCKET_NAME || 'pravesh';
  }

  private getR2PublicUrl(): string {
    return this.configService?.get<string>('R2_PUBLIC_URL') || process.env.R2_PUBLIC_URL || '';
  }

  private buildR2PublicUrl(key: string): string {
    const publicUrl = this.getR2PublicUrl();
    if (publicUrl) {
      return `${publicUrl.replace(/\/$/, '')}/${key}`;
    }
    // Fallback: construct from endpoint + bucket (not ideal but for tests)
    const endpoint = this.configService?.get<string>('R2_ENDPOINT') || process.env.R2_ENDPOINT || '';
    const bucket = this.getR2Bucket();
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    }
    return key;
  }

  private ensureBaseFolders() {
    try {
      // For R2, events are stored remotely, not locally; keep organizers, users, other locally
      const cats = ['organizers', 'users', 'other'];
      for (const cat of cats) {
        const dir = path.join(this.uploadsRoot, cat);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
      }
    } catch (e) {
      this.logger.warn(`Failed to ensure base upload folders: ${(e as Error).message}`);
    }
  }

  private getUploadsRoot(): string {
    return this.uploadsRoot;
  }

  private validateFile(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    if (!this.allowedMimetypes.includes(file.mimetype)) {
      throw new BadRequestException(`Invalid file type ${file.mimetype}. Allowed: jpg, jpeg, png, webp`);
    }
    if (file.size > this.maxBytes) {
      throw new BadRequestException(`File too large: ${file.size} bytes. Maximum 5 MB`);
    }
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Empty file');
    }
  }

  private getExtensionFromMimetype(mimetype: string): string {
    if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') return 'jpg';
    if (mimetype === 'image/png') return 'png';
    if (mimetype === 'image/webp') return 'webp';
    throw new BadRequestException(`Unsupported mimetype ${mimetype}`);
  }

  private sanitizeId(id: string | number): string {
    const str = String(id).trim();
    // Prevent path traversal: only allow alphanumeric, -, _, and for numeric ids digits
    if (str.includes('..') || str.includes('/') || str.includes('\\') || str.includes('\0')) {
      throw new BadRequestException('Invalid ID');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(str)) {
      throw new BadRequestException('Invalid ID format');
    }
    return str;
  }

  private ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private safeJoin(...segments: string[]): string {
    const joined = path.join(...segments);
    const root = this.getUploadsRoot();
    const resolved = path.resolve(joined);
    const resolvedRoot = path.resolve(root);
    if (!resolved.startsWith(resolvedRoot)) {
      throw new BadRequestException('Invalid path');
    }
    return resolved;
  }

  private deleteExistingByPrefix(dir: string, prefix: string) {
    try {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.startsWith(prefix + '.')) {
          const full = path.join(dir, f);
          try {
            fs.unlinkSync(full);
          } catch {}
        }
      }
    } catch {}
  }

  private validateImageDimensions(buffer: Buffer, type: 'square' | 'rectangle') {
    let dimensions: { width: number; height: number };
    try {
      dimensions = sizeOf(buffer);
    } catch (e) {
      throw new BadRequestException('Invalid image file');
    }
    const { width, height } = dimensions;
    if (!width || !height) throw new BadRequestException('Invalid image dimensions');
    if (type === 'square') {
      const ratio = width / height;
      // Approximately 1:1, tolerance 0.1 (0.9 - 1.1)
      if (ratio < 0.9 || ratio > 1.1) {
        throw new BadRequestException(`Square poster must be 1:1 aspect ratio (got ${width}x${height}, ratio ${ratio.toFixed(2)})`);
      }
    } else if (type === 'rectangle') {
      const ratio = width / height;
      // Must be landscape and approx 16:9 (1.777) with tolerance, allow 1.5-2.0
      if (width <= height) {
        throw new BadRequestException(`Rectangle poster must be landscape (width > height), got ${width}x${height}`);
      }
      if (ratio < 1.5 || ratio > 2.0) {
        throw new BadRequestException(`Rectangle poster must be ~16:9 landscape (ratio 1.5-2.0), got ${ratio.toFixed(2)} (${width}x${height})`);
      }
    }
  }

  private async uploadToR2(buffer: Buffer, key: string, mimetype: string): Promise<string> {
    const client = this.getR2Client();
    const bucket = this.getR2Bucket();
    if (!client) {
      // No R2 config (tests) — return mock public URL
      this.logger.warn('R2 client not configured — returning mock URL for tests');
      return this.buildR2PublicUrl(key) || `https://mock-r2.example.com/${key}`;
    }
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: mimetype,
      }),
    );
    return this.buildR2PublicUrl(key);
  }

  private async deleteFromR2(key: string): Promise<void> {
    const client = this.getR2Client();
    const bucket = this.getR2Bucket();
    if (!client) return;
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (e) {
      this.logger.warn(`Failed to delete R2 object ${key}: ${(e as Error).message}`);
    }
  }

  private async deleteR2ByPrefix(eventId: string, prefix: string) {
    const exts = ['jpg', 'jpeg', 'png', 'webp'];
    for (const ext of exts) {
      const key = `events/${eventId}/${prefix}.${ext}`;
      // Try to delete all variants; ignore errors
      await this.deleteFromR2(key).catch(() => {});
    }
  }

  /**
   * Save generic event poster at R2: events/{eventId}/poster.{ext}
   * For backward compat, no dimension validation, just type/size.
   */
  async saveEventPoster(file: Express.Multer.File, eventId: number | string): Promise<{ url: string; key: string }> {
    this.validateFile(file);
    const safeId = this.sanitizeId(eventId);
    const ext = this.getExtensionFromMimetype(file.mimetype);
    const key = `events/${safeId}/poster.${ext}`;
    await this.deleteR2ByPrefix(safeId, 'poster');
    const url = await this.uploadToR2(file.buffer, key, file.mimetype);
    return { url, key };
  }

  /**
   * Save event poster-square at R2: events/{eventId}/poster-square.{ext}
   * Replaces previous square poster safely.
   */
  async saveEventPosterSquare(file: Express.Multer.File, eventId: number | string): Promise<{ url: string; key: string }> {
    this.validateFile(file);
    this.validateImageDimensions(file.buffer, 'square');
    const safeId = this.sanitizeId(eventId);
    const ext = this.getExtensionFromMimetype(file.mimetype);
    const key = `events/${safeId}/poster-square.${ext}`;
    // Delete old square variants with different extensions
    await this.deleteR2ByPrefix(safeId, 'poster-square');
    const url = await this.uploadToR2(file.buffer, key, file.mimetype);
    return { url, key };
  }

  /**
   * Save event poster-rectangle at R2: events/{eventId}/poster-rectangle.{ext}
   * Replaces previous rectangle poster safely.
   */
  async saveEventPosterRectangle(file: Express.Multer.File, eventId: number | string): Promise<{ url: string; key: string }> {
    this.validateFile(file);
    this.validateImageDimensions(file.buffer, 'rectangle');
    const safeId = this.sanitizeId(eventId);
    const ext = this.getExtensionFromMimetype(file.mimetype);
    const key = `events/${safeId}/poster-rectangle.${ext}`;
    await this.deleteR2ByPrefix(safeId, 'poster-rectangle');
    const url = await this.uploadToR2(file.buffer, key, file.mimetype);
    return { url, key };
  }

  // Backward compat alias for old callers (EventsService)
  async uploadPoster(file: Express.Multer.File, eventId: number | string): Promise<{ url: string; key: string }> {
    return this.saveEventPoster(file, eventId);
  }

  // Organizer/user local storage removed — keep only R2 for event posters (generic + square/rectangle)

  // Generic upload for other category (not used in new flow but kept for compat)
  async upload(file: Express.Multer.File, dirPath?: string): Promise<{ url: string; key: string }> {
    this.validateFile(file);
    const ext = this.getExtensionFromMimetype(file.mimetype);
    const safeDir = dirPath ? dirPath.replace(/\.\./g, '').replace(/^\/+/, '') : 'other';
    // Prevent arbitrary paths, only allow under uploads
    const dir = this.safeJoin(this.getUploadsRoot(), safeDir);
    this.ensureDir(dir);
    const filename = `file_${Date.now()}.${ext}`;
    const fullPath = this.safeJoin(dir, filename);
    fs.writeFileSync(fullPath, file.buffer);
    const relativeUrl = `/uploads/${safeDir}/${filename}`;
    return { url: relativeUrl, key: relativeUrl };
  }

  private localDir(subdir: string): string {
    return path.join(process.cwd(), 'uploads', subdir);
  }

  /**
   * Upload a withdrawal payment-proof screenshot.
   * Uses Azure Blob when configured, otherwise a local-disk fallback under
   * ./uploads/proofs (dev). Local files are served ONLY through the
   * authenticated GET /api/withdrawals/:id/proof endpoint — never statically.
   * Returns a storage URL: https://... for Azure, local://proofs/<file> for disk.
   */
  async uploadProof(file: Express.Multer.File, withdrawalId: string): Promise<{ url: string; key: string }> {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filename = `${withdrawalId}-${randomUUID()}-${sanitized}`;
    if (this.containerClient) {
      const container = await this.ensureContainer();
      const blobName = `proofs/${filename}`;
      const blockBlobClient = container.getBlockBlobClient(blobName);
      await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype },
      });
      return { url: blockBlobClient.url, key: blobName };
    }
    const dir = this.localDir('proofs');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, filename), file.buffer);
    return { url: `local://proofs/${filename}`, key: filename };
  }

  /**
   * Read a local:// storage URL back from disk (with traversal guard).
   */
  async readLocalFile(url: string): Promise<{ buffer: Buffer; mimetype: string }> {
    const prefix = 'local://proofs/';
    if (!url.startsWith(prefix)) throw new Error('Not a local storage URL');
    const filename = path.basename(url.slice(prefix.length));
    if (!filename) throw new Error('Invalid storage URL');
    const buffer = await fs.readFile(path.join(this.localDir('proofs'), filename));
    const ext = path.extname(filename).toLowerCase();
    const mimetype = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    return { buffer, mimetype };
  }

  async delete(key: string): Promise<void> {
    if (!key) return;
    try {
      // key is relative url like /uploads/events/1/poster.jpg
      const clean = key.replace(/^\//, '');
      const full = this.safeJoin(this.getUploadsRoot(), '..', clean); // careful: clean already includes uploads/
      // Simpler: join process.cwd() with clean
      const absolute = path.join(process.cwd(), clean);
      const resolved = path.resolve(absolute);
      const root = path.resolve(this.getUploadsRoot());
      // Also allow root being server/uploads, check both
      if (!resolved.startsWith(root) && !resolved.startsWith(path.resolve(path.join(process.cwd(), 'uploads')))) {
        return;
      }
      if (fs.existsSync(resolved)) fs.unlinkSync(resolved);
    } catch (e) {
      this.logger.warn(`Failed to delete local file ${key}: ${(e as Error).message}`);
    }
  }

  async deleteByUrl(url: string): Promise<void> {
    if (!url) return;
    // For local storage, url is same as key like /uploads/events/1/poster.jpg
    // Old Azure URLs contain https://... we should ignore those (no local file)
    if (url.startsWith('http://') || url.startsWith('https://')) {
      // Could be old Azure URL — try to extract path but local file won't exist; just no-op
      // Attempt to delete by local pattern if it contains /uploads/
      const idx = url.indexOf('/uploads/');
      if (idx !== -1) {
        const localPart = url.substring(idx);
        return this.delete(localPart);
      }
      return;
    }
    return this.delete(url);
  }

  // Helper for testing: get absolute path from relative url
  getAbsolutePath(relativeUrl: string): string {
    const clean = relativeUrl.replace(/^\//, '');
    return path.join(process.cwd(), clean);
  }

  private extractR2KeyFromUrl(url: string): string | null {
    try {
      const publicUrl = this.getR2PublicUrl();
      if (publicUrl && url.startsWith(publicUrl)) {
        return url.substring(publicUrl.length).replace(/^\//, '');
      }
      // Fallback: try to extract events/... part
      const idx = url.indexOf('events/');
      if (idx !== -1) return url.substring(idx).split('?')[0];
      // If url is already a key
      if (url.startsWith('events/')) return url;
      return null;
    } catch {
      return null;
    }
  }

  private async deleteR2ByUrl(url: string): Promise<void> {
    const key = this.extractR2KeyFromUrl(url);
    if (key) await this.deleteFromR2(key).catch(() => {});
  }

  // ── Storage handlers for R2 event posters (Controller → Service → Repository → Prisma) ──

  async handleEventPosterUpload(file: Express.Multer.File, eventId: number, user: RequestUser) {
    if (!file) throw new BadRequestException('File is required');
    if (!this.storageRepo) throw new BadRequestException('Storage repository not configured');
    const event = await this.storageRepo.findEventById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    const userId = user.userId || user.id;
    const role = user.role;
    if (role !== Role.ADMIN) {
      const organizer = await this.storageRepo.findOrganizerByUserId(userId);
      if (!organizer || event.organizerId !== organizer.id) {
        throw new ForbiddenException('You do not own this event');
      }
    }
    const { url } = await this.saveEventPoster(file, eventId);
    const oldUrl = (event as any).posterUrl;
    const updated = await this.storageRepo.updateEventPoster(eventId, url);
    if (oldUrl && oldUrl !== url) await this.deleteR2ByUrl(oldUrl).catch(() => {});
    return { message: 'Event poster uploaded successfully', posterUrl: updated.posterUrl };
  }

  async handleEventPosterSquareUpload(file: Express.Multer.File, eventId: number, user: RequestUser) {
    if (!file) throw new BadRequestException('File is required');
    if (!this.storageRepo) throw new BadRequestException('Storage repository not configured');
    const event = await this.storageRepo.findEventById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    const userId = user.userId || user.id;
    const role = user.role;
    if (role !== Role.ADMIN) {
      const organizer = await this.storageRepo.findOrganizerByUserId(userId);
      if (!organizer || event.organizerId !== organizer.id) {
        throw new ForbiddenException('You do not own this event');
      }
    }
    const { url } = await this.saveEventPosterSquare(file, eventId);
    const oldUrl = (event as any).posterSquareUrl;
    const updated = await this.storageRepo.updateEventPosterSquare(eventId, url);
    if (oldUrl && oldUrl !== url) await this.deleteR2ByUrl(oldUrl).catch(() => {});
    return { message: 'Event square poster uploaded successfully', posterSquareUrl: updated.posterSquareUrl };
  }

  async handleEventPosterRectangleUpload(file: Express.Multer.File, eventId: number, user: RequestUser) {
    if (!file) throw new BadRequestException('File is required');
    if (!this.storageRepo) throw new BadRequestException('Storage repository not configured');
    const event = await this.storageRepo.findEventById(eventId);
    if (!event) throw new NotFoundException('Event not found');
    const userId = user.userId || user.id;
    const role = user.role;
    if (role !== Role.ADMIN) {
      const organizer = await this.storageRepo.findOrganizerByUserId(userId);
      if (!organizer || event.organizerId !== organizer.id) {
        throw new ForbiddenException('You do not own this event');
      }
    }
    const { url } = await this.saveEventPosterRectangle(file, eventId);
    const oldUrl = (event as any).posterRectangleUrl;
    const updated = await this.storageRepo.updateEventPosterRectangle(eventId, url);
    if (oldUrl && oldUrl !== url) await this.deleteR2ByUrl(oldUrl).catch(() => {});
    return { message: 'Event rectangle poster uploaded successfully', posterRectangleUrl: updated.posterRectangleUrl };
  }
}
