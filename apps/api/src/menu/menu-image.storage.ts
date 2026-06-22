import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { SupabaseStorageService } from '../supabase/supabase-storage.service';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MenuImageStorageService {
  readonly menuRoot: string;
  private readonly useSupabase: boolean;

  constructor(
    config: ConfigService,
    private readonly supabaseStorage: SupabaseStorageService,
  ) {
    const uploadsDir = config.get<string>('uploadsDir', 'uploads');
    this.menuRoot = join(process.cwd(), uploadsDir, 'menu');
    this.useSupabase = config.get<boolean>('storage.useSupabase', false);
    if (!this.useSupabase) {
      mkdirSync(this.menuRoot, { recursive: true });
    }
  }

  assertValidUpload(mimetype: string, size: number) {
    if (!ALLOWED_MIME.has(mimetype)) {
      throw new BadRequestException('Image must be JPEG, PNG, WebP, or GIF');
    }
    if (size > 0 && size > MAX_BYTES) {
      throw new BadRequestException('Image must be 5 MB or smaller');
    }
  }

  orgDir(organizationId: string) {
    const dir = join(this.menuRoot, organizationId);
    mkdirSync(dir, { recursive: true });
    return dir;
  }

  async saveUpload(
    organizationId: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    if (this.useSupabase) {
      const storagePath = `${organizationId}/${filename}`;
      return this.supabaseStorage.uploadObject(storagePath, buffer, contentType);
    }

    const dir = this.orgDir(organizationId);
    const { writeFile } = await import('fs/promises');
    await writeFile(join(dir, filename), buffer);
    return this.publicUrl(organizationId, filename);
  }

  async prepareSignedUpload(
    organizationId: string,
    contentType: string,
    extension: string,
  ) {
    this.assertValidUpload(contentType, 1);

    if (!this.useSupabase) {
      return null;
    }

    const safeExt = extension.startsWith('.') ? extension : `.${extension}`;
    const filename = `${randomUUID()}${safeExt}`;
    const storagePath = `${organizationId}/${filename}`;
    const signed = await this.supabaseStorage.createSignedUpload(storagePath);

    return {
      filename,
      path: signed.path,
      token: signed.token,
      signedUrl: signed.signedUrl,
      publicUrl: this.supabaseStorage.publicUrl(storagePath),
    };
  }

  publicUrl(organizationId: string, filename: string) {
    if (this.useSupabase) {
      return this.supabaseStorage.publicUrl(`${organizationId}/${filename}`);
    }
    return `/api/v1/uploads/menu/${organizationId}/${filename}`;
  }
}
