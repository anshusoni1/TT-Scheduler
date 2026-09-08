import type { Profile, TypedSupabaseClient } from '@/types/database';
import { NotFoundError, AppError } from '@/lib/errors';

export class ProfilesRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch profile: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  async updateProfile(userId: string, updates: Partial<Omit<Profile, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) {
      throw new AppError(`Failed to update profile: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    if (!data) {
      throw new NotFoundError('Profile not found');
    }

    return data;
  }

  async upsertProfile(userId: string, initialData: { name: string; timezone?: string; college?: string; course?: string; branch?: string; semester?: number; section?: string }): Promise<Profile> {
    const { data, error } = await this.supabase
      .from('profiles')
      .upsert({
        id: userId,
        user_id: userId,
        name: initialData.name,
        timezone: initialData.timezone ?? 'Asia/Kolkata',
        college: initialData.college ?? null,
        course: initialData.course ?? null,
        branch: initialData.branch ?? null,
        semester: initialData.semester ?? null,
        section: initialData.section ?? null,
      })
      .select('*')
      .single();

    if (error) {
      throw new AppError(`Failed to upsert profile: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }
}
