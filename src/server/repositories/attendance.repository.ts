import type {
  AttendanceRecord,
  AttendanceStatus,
  TypedSupabaseClient,
} from '@/types/database';
import { AppError } from '@/lib/errors';

export interface MarkAttendanceInput {
  date: string;
  timetable_entry_id?: string | null;
  occurrence_context?: string;
  status: AttendanceStatus;
  notes?: string | null;
}

export class AttendanceRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  /**
   * Retrieves all attendance records for a user, optionally bounded by a date range.
   */
  async getAttendanceRecords(
    userId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<AttendanceRecord[]> {
    let query = this.supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    if (fromDate) {
      query = query.gte('date', fromDate);
    }
    if (toDate) {
      query = query.lte('date', toDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new AppError(`Failed to fetch attendance records: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  /**
   * Retrieves attendance records for a user on a specific single date.
   */
  async getAttendanceForDate(userId: string, date: string): Promise<AttendanceRecord[]> {
    const { data, error } = await this.supabase
      .from('attendance_records')
      .select('*')
      .eq('user_id', userId)
      .eq('date', date);

    if (error) {
      throw new AppError(`Failed to fetch attendance for date ${date}: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  /**
   * Upserts an attendance record for a specific class occurrence.
   * If status is 'not_marked', deletes any existing record for this occurrence.
   */
  async setAttendance(userId: string, input: MarkAttendanceInput): Promise<AttendanceRecord | null> {
    const context = input.occurrence_context || 'regular';
    const entryId = input.timetable_entry_id || null;

    if (input.status === 'not_marked') {
      let delQuery = this.supabase
        .from('attendance_records')
        .delete()
        .eq('user_id', userId)
        .eq('date', input.date)
        .eq('occurrence_context', context);

      if (entryId) {
        delQuery = delQuery.eq('timetable_entry_id', entryId);
      } else {
        delQuery = delQuery.is('timetable_entry_id', null);
      }

      const { error } = await delQuery;
      if (error) {
        throw new AppError(`Failed to reset attendance: ${error.message}`, 'INTERNAL_ERROR', 500, error);
      }
      return null;
    }

    // Upsert the attendance record using unique constraint
    const { data, error } = await this.supabase
      .from('attendance_records')
      .upsert(
        {
          user_id: userId,
          date: input.date,
          timetable_entry_id: entryId,
          occurrence_context: context,
          status: input.status,
          notes: input.notes || null,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,date,timetable_entry_id,occurrence_context',
        }
      )
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to mark attendance: ${error?.message || 'Upsert failed'}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }
}
