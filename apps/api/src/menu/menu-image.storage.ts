import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { join } from 'path';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MenuImageStorageService {
  readonly menuRoot: string;

  constructor(config: ConfigService) {
    const uploadsDir = config.get<string>('uploadsDir', 'uploads');
    this.menuRoot = join(process.cwd(), uploadsDir, 'menu');
    mkdirSync(this.menuRoot, { recursive: true });
  }

  assertValidUpload(mimetype: string, size: number) {
    if (!ALLOWED_MIME.has(mimetype)) {
      throw new BadRequestException('Image must be JPEG, PNG, WebP, or GIF');
    }
    if (size > MAX_BYTES) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }
  }

  orgDir(organizationId: string) {
    const dir = join(this.menuRoot, organizationId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  publicUrl(organizationId: string, filename: string) {
    return `/api/v1/uploads/menu/${organizationId}/${filename}`;
  }
}
