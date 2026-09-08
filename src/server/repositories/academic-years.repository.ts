import type { AcademicYear, TypedSupabaseClient } from '@/types/database';
import { NotFoundError, AppError } from '@/lib/errors';

export class AcademicYearsRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getAcademicYears(userId: string): Promise<AcademicYear[]> {
    const { data, error } = await this.supabase
      .from('academic_years')
      .select('*')
      .eq('user_id', userId)
      .order('start_date', { ascending: false });

    if (error) {
      throw new AppError(`Failed to fetch academic years: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  async getActiveAcademicYear(userId: string): Promise<AcademicYear | null> {
    const { data, error } = await this.supabase
      .from('academic_years')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch active academic year: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  async createAcademicYear(
    userId: string,
    yearData: { name: string; start_date: string; end_date: string; semester?: number | null; is_active?: boolean }
  ): Promise<AcademicYear> {
    if (yearData.is_active) {
      // Deactivate other years for this user
      await this.supabase
        .from('academic_years')
        .update({ is_active: false })
        .eq('user_id', userId);
    }

    const { data, error } = await this.supabase
      .from('academic_years')
      .insert({
        user_id: userId,
        name: yearData.name,
        start_date: yearData.start_date,
        end_date: yearData.end_date,
        semester: yearData.semester ?? null,
        is_active: yearData.is_active ?? false,
      })
      .select('*')
      .single();

    if (error) {
      throw new AppError(`Failed to create academic year: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  async setActiveAcademicYear(userId: string, academicYearId: string): Promise<void> {
    // Check ownership
    const { data: existing, error: checkError } = await this.supabase
      .from('academic_years')
      .select('id')
      .eq('id', academicYearId)
      .eq('user_id', userId)
      .maybeSingle();

    if (checkError) {
      throw new AppError(`Failed to verify academic year: ${checkError.message}`, 'INTERNAL_ERROR', 500);
    }

    if (!existing) {
      throw new NotFoundError('Academic year not found or not owned by user');
    }

    // Set all to inactive
    await this.supabase
      .from('academic_years')
      .update({ is_active: false })
      .eq('user_id', userId);

    // Set target to active
    const { error: updateError } = await this.supabase
      .from('academic_years')
      .update({ is_active: true })
      .eq('id', academicYearId)
      .eq('user_id', userId);

    if (updateError) {
      throw new AppError(`Failed to activate academic year: ${updateError.message}`, 'INTERNAL_ERROR', 500);
    }
  }
}
