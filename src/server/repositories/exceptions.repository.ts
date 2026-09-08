import type { ScheduleException, ExceptionType, TypedSupabaseClient } from '@/types/database';
import { AppError, NotFoundError, ForbiddenError } from '@/lib/errors';

export interface CreateExceptionInput {
  date: string;
  exception_type: ExceptionType;
  original_timetable_entry_id?: string | null;
  subject_name?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  room?: string | null;
  reason?: string | null;
}

export class ExceptionsRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getUserExceptions(userId: string): Promise<ScheduleException[]> {
    const { data, error } = await this.supabase
      .from('schedule_exceptions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true });

    if (error) {
      throw new AppError(`Failed to fetch exceptions: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  async getExceptionById(userId: string, exceptionId: string): Promise<ScheduleException> {
    const { data, error } = await this.supabase
      .from('schedule_exceptions')
      .select('*')
      .eq('id', exceptionId)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch exception: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    if (!data) {
      throw new NotFoundError('Schedule exception not found');
    }

    if (data.user_id !== userId) {
      throw new ForbiddenError('You do not have access to this exception');
    }

    return data;
  }

  async getExceptionsForDate(userId: string, date: string): Promise<ScheduleException[]> {
    const { data, error } = await this.supabase
      .from('schedule_exceptions')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (error) {
      throw new AppError(`Failed to fetch exceptions for date: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  async getExceptionsForRange(userId: string, startDate: string, endDate: string): Promise<ScheduleException[]> {
    const { data, error } = await this.supabase
      .from('schedule_exceptions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });

    if (error) {
      throw new AppError(`Failed to fetch exceptions for range: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  async createException(userId: string, input: CreateExceptionInput): Promise<ScheduleException> {
    const { data, error } = await this.supabase
      .from('schedule_exceptions')
      .insert({
        user_id: userId,
        date: input.date,
        exception_type: input.exception_type,
        original_timetable_entry_id: input.original_timetable_entry_id ?? null,
        subject_name: input.subject_name ?? null,
        start_time: input.start_time ?? null,
        end_time: input.end_time ?? null,
        room: input.room ?? null,
        reason: input.reason ?? null,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to create schedule exception: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  async updateException(
    userId: string,
    exceptionId: string,
    updates: Partial<CreateExceptionInput>
  ): Promise<ScheduleException> {
    await this.getExceptionById(userId, exceptionId);

    const updatePayload: Record<string, unknown> = {};
    if (updates.date !== undefined) updatePayload.date = updates.date;
    if (updates.exception_type !== undefined) updatePayload.exception_type = updates.exception_type;
    if (updates.original_timetable_entry_id !== undefined) {
      updatePayload.original_timetable_entry_id = updates.original_timetable_entry_id;
    }
    if (updates.subject_name !== undefined) updatePayload.subject_name = updates.subject_name;
    if (updates.start_time !== undefined) updatePayload.start_time = updates.start_time;
    if (updates.end_time !== undefined) updatePayload.end_time = updates.end_time;
    if (updates.room !== undefined) updatePayload.room = updates.room;
    if (updates.reason !== undefined) updatePayload.reason = updates.reason;

    const { data: updated, error } = await this.supabase
      .from('schedule_exceptions')
      .update(updatePayload)
      .eq('id', exceptionId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new AppError(`Failed to update exception: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return updated;
  }

  async deleteException(userId: string, exceptionId: string): Promise<void> {
    await this.getExceptionById(userId, exceptionId);

    const { error } = await this.supabase
      .from('schedule_exceptions')
      .delete()
      .eq('id', exceptionId)
      .eq('user_id', userId);

    if (error) {
      throw new AppError(`Failed to delete exception: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }
  }
}
