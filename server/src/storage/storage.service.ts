import { Injectable } from '@nestjs/common';

/**
 * StorageService — abstraction for event banners and uploaded files.
 * Supports local / S3 via STORAGE_PROVIDER env.
 * Business logic to be implemented in next phase.
 */
@Injectable()
export class StorageService {
  async upload(
    _file: Express.Multer.File,
    _path?: string,
  ): Promise<{ url: string; key: string }> {
    // TODO: implement storage provider logic
    return { url: '', key: '' };
  }

  async delete(_key: string): Promise<void> {
    // TODO: implement deletion
  }
}
