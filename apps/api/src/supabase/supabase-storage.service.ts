import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseStorageService {
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: SupabaseClient | null = null;

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(this.config.get<string>('supabase.url') && this.config.get<string>('supabase.serviceRoleKey'));
  }

  private getClient(): SupabaseClient {
    if (this.client) return this.client;

    const url = this.config.get<string>('supabase.url');
    const serviceRoleKey = this.config.get<string>('supabase.serviceRoleKey');
    if (!url || !serviceRoleKey) {
      throw new InternalServerErrorException('Supabase Storage is not configured');
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return this.client;
  }

  get bucket(): string {
    return this.config.get<string>('supabase.storageBucket', 'menu-images');
  }

  async uploadObject(
    storagePath: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.getClient()
      .storage
      .from(this.bucket)
      .upload(storagePath, body, { contentType, upsert: true });

    if (error) {
      this.logger.error(`Supabase upload failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to upload image');
    }

    return this.publicUrl(storagePath);
  }

  async createSignedUpload(
    storagePath: string,
  ): Promise<{ signedUrl: string; token: string; path: string }> {
    const { data, error } = await this.getClient()
      .storage
      .from(this.bucket)
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      this.logger.error(`Supabase signed upload failed: ${error?.message ?? 'unknown'}`);
      throw new InternalServerErrorException('Failed to prepare image upload');
    }

    return data;
  }

  publicUrl(storagePath: string): string {
    const url = this.config.get<string>('supabase.url');
    if (!url) {
      throw new InternalServerErrorException('Supabase Storage is not configured');
    }
    const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
    return `${url}/storage/v1/object/public/${this.bucket}/${encoded}`;
  }
}
