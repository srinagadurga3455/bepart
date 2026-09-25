import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BlobServiceClient, ContainerClient } from '@azure/storage-blob';
import { randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private containerName: string;

  constructor(private readonly configService: ConfigService) {
    this.containerName = this.configService.get<string>('AZURE_STORAGE_CONTAINER', 'event-posters');
    const connectionString = this.configService.get<string>('AZURE_STORAGE_CONNECTION_STRING');
    if (connectionString) {
      try {
        this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        this.containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      } catch (e) {
        this.logger.warn('Failed to initialize Azure Blob Service Client — poster uploads will fail until AZURE_STORAGE_CONNECTION_STRING is valid');
      }
    } else {
      this.logger.warn('AZURE_STORAGE_CONNECTION_STRING not set — StorageService in mock mode');
    }
  }

  private async ensureContainer(): Promise<ContainerClient> {
    if (!this.containerClient) {
      throw new Error('Azure Storage not configured: AZURE_STORAGE_CONNECTION_STRING missing');
    }
    await this.containerClient.createIfNotExists({ access: 'blob' });
    return this.containerClient;
  }

  /**
   * Upload event poster to Azure Blob Storage.
   * Blob name: events/{eventId}/{uuid}-{originalFilename}
   * Returns public blob URL.
   */
  async uploadPoster(file: Express.Multer.File, eventId: number | string): Promise<{ url: string; key: string }> {
    const container = await this.ensureContainer();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobName = `events/${eventId}/${randomUUID()}-${sanitized}`;
    const blockBlobClient = container.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });
    return { url: blockBlobClient.url, key: blobName };
  }

  // Keep generic upload for backward compatibility — delegates to Azure if configured
  async upload(file: Express.Multer.File, path?: string): Promise<{ url: string; key: string }> {
    // If path looks like events/{id}, use uploadPoster semantics
    if (path?.startsWith('events/')) {
      const eventId = path.split('/')[1] || 'unknown';
      return this.uploadPoster(file, eventId);
    }
    // Fallback: upload to container root with uuid
    const container = await this.ensureContainer();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobName = path ? `${path}/${randomUUID()}-${sanitized}` : `${randomUUID()}-${sanitized}`;
    const blockBlobClient = container.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: { blobContentType: file.mimetype },
    });
    return { url: blockBlobClient.url, key: blobName };
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
      const container = await this.ensureContainer();
      const blockBlobClient = container.getBlockBlobClient(key);
      await blockBlobClient.deleteIfExists();
    } catch (e) {
      this.logger.warn(`Failed to delete blob ${key}: ${(e as Error).message}`);
    }
  }

  /**
   * Delete by full URL — extracts blob name after container.
   */
  async deleteByUrl(url: string): Promise<void> {
    if (!url) return;
    try {
      const container = await this.ensureContainer();
      // URL format: https://account.blob.core.windows.net/{container}/{blobName}
      const urlObj = new URL(url);
      const pathname = decodeURIComponent(urlObj.pathname); // /{container}/{blob}
      const prefix = `/${this.containerName}/`;
      let blobName = '';
      if (pathname.startsWith(prefix)) {
        blobName = pathname.slice(prefix.length);
      } else {
        // Fallback: strip leading slash and container
        const parts = pathname.split('/').filter(Boolean);
        if (parts.length > 1 && parts[0] === this.containerName) {
          blobName = parts.slice(1).join('/');
        } else {
          blobName = pathname.replace(/^\//, '');
        }
      }
      if (!blobName) return;
      const blockBlobClient = container.getBlockBlobClient(blobName);
      await blockBlobClient.deleteIfExists();
    } catch (e) {
      this.logger.warn(`Failed to delete blob by url ${url}: ${(e as Error).message}`);
    }
  }
}
