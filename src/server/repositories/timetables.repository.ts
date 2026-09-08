import type { Timetable, TimetableEntry, DayOfWeek, ClassType, TypedSupabaseClient } from '@/types/database';
import { NotFoundError, AppError, ForbiddenError } from '@/lib/errors';
import { doTimesOverlap } from '@/lib/dates';

export interface TimetableWithEntries extends Timetable {
  entries: TimetableEntry[];
}

export interface CreateTimetableInput {
  academic_year_id?: string | null;
  name: string;
  effective_from: string;
  effective_to?: string | null;
  timezone?: string;
  active?: boolean;
}

export interface CreateTimetableEntryInput {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  subject_name: string;
  subject_code?: string | null;
  faculty_name?: string | null;
  room?: string | null;
  class_type?: ClassType;
  section?: string | null;
  notes?: string | null;
}

export class TimetablesRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  /**
   * Retrieves all timetables for a user, ordered by creation date descending.
   */
  async getUserTimetables(userId: string): Promise<TimetableWithEntries[]> {
    const { data: timetables, error: ttError } = await this.supabase
      .from('timetables')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (ttError) {
      throw new AppError(`Failed to fetch timetables: ${ttError.message}`, 'INTERNAL_ERROR', 500, ttError);
    }

    if (!timetables || timetables.length === 0) {
      return [];
    }

    const timetableIds = timetables.map((t) => t.id);
    const { data: allEntries, error: entriesError } = await this.supabase
      .from('timetable_entries')
      .select('*')
      .in('timetable_id', timetableIds)
      .order('start_time', { ascending: true });

    if (entriesError) {
      throw new AppError(`Failed to fetch timetable entries: ${entriesError.message}`, 'INTERNAL_ERROR', 500, entriesError);
    }

    const entriesByTtId = new Map<string, TimetableEntry[]>();
    for (const entry of allEntries || []) {
      const list = entriesByTtId.get(entry.timetable_id) || [];
      list.push(entry);
      entriesByTtId.set(entry.timetable_id, list);
    }

    return timetables.map((t) => ({
      ...t,
      entries: entriesByTtId.get(t.id) || [],
    }));
  }

  /**
   * Retrieves the currently active timetable for a user.
   */
  async getActiveTimetable(userId: string): Promise<TimetableWithEntries | null> {
    const { data: timetable, error: ttError } = await this.supabase
      .from('timetables')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (ttError) {
      throw new AppError(`Failed to fetch active timetable: ${ttError.message}`, 'INTERNAL_ERROR', 500, ttError);
    }

    if (!timetable) {
      return null;
    }

    const { data: entries, error: entriesError } = await this.supabase
      .from('timetable_entries')
      .select('*')
      .eq('timetable_id', timetable.id)
      .order('start_time', { ascending: true });

    if (entriesError) {
      throw new AppError(`Failed to fetch timetable entries: ${entriesError.message}`, 'INTERNAL_ERROR', 500, entriesError);
    }

    return {
      ...timetable,
      entries: entries || [],
    };
  }

  /**
   * Retrieves a timetable by ID and validates ownership by userId.
   */
  async getTimetableById(userId: string, timetableId: string): Promise<TimetableWithEntries> {
    const { data: timetable, error: ttError } = await this.supabase
      .from('timetables')
      .select('*')
      .eq('id', timetableId)
      .maybeSingle();

    if (ttError) {
      throw new AppError(`Failed to fetch timetable: ${ttError.message}`, 'INTERNAL_ERROR', 500, ttError);
    }

    if (!timetable) {
      throw new NotFoundError('Timetable not found');
    }

    if (timetable.user_id !== userId) {
      throw new ForbiddenError('You do not have access to this timetable');
    }

    const { data: entries, error: entriesError } = await this.supabase
      .from('timetable_entries')
      .select('*')
      .eq('timetable_id', timetable.id)
      .order('start_time', { ascending: true });

    if (entriesError) {
      throw new AppError(`Failed to fetch timetable entries: ${entriesError.message}`, 'INTERNAL_ERROR', 500, entriesError);
    }

    return {
      ...timetable,
      entries: entries || [],
    };
  }

  /**
   * Checks if an entry time interval overlaps with any existing entries on that day.
   */
  async checkTimeConflict(
    timetableId: string,
    dayOfWeek: DayOfWeek,
    startTime: string,
    endTime: string,
    excludeEntryId?: string
  ): Promise<{ hasConflict: boolean; conflictingEntry?: TimetableEntry }> {
    const { data: existingEntries, error } = await this.supabase
      .from('timetable_entries')
      .select('*')
      .eq('timetable_id', timetableId)
      .eq('day_of_week', dayOfWeek);

    if (error) {
      throw new AppError(`Failed to check time conflicts: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    for (const existing of existingEntries || []) {
      if (excludeEntryId && existing.id === excludeEntryId) {
        continue;
      }

      if (doTimesOverlap(existing.start_time, existing.end_time, startTime, endTime)) {
        return {
          hasConflict: true,
          conflictingEntry: existing,
        };
      }
    }

    return { hasConflict: false };
  }

  /**
   * Creates a new timetable. If marked active, previous active timetables are deactivated.
   */
  async createTimetable(
    userId: string,
    timetableData: CreateTimetableInput,
    entries: CreateTimetableEntryInput[] = []
  ): Promise<TimetableWithEntries> {
    if (timetableData.active) {
      await this.supabase
        .from('timetables')
        .update({ active: false })
        .eq('user_id', userId);
    }

    const { data: timetable, error: ttError } = await this.supabase
      .from('timetables')
      .insert({
        user_id: userId,
        academic_year_id: timetableData.academic_year_id ?? null,
        name: timetableData.name,
        effective_from: timetableData.effective_from,
        effective_to: timetableData.effective_to ?? null,
        timezone: timetableData.timezone ?? 'Asia/Kolkata',
        active: timetableData.active ?? true,
      })
      .select('*')
      .single();

    if (ttError || !timetable) {
      throw new AppError(`Failed to create timetable: ${ttError?.message}`, 'INTERNAL_ERROR', 500, ttError);
    }

    let insertedEntries: TimetableEntry[] = [];

    if (entries.length > 0) {
      // Validate no internal overlaps within the new batch
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          if (
            entries[i].day_of_week === entries[j].day_of_week &&
            doTimesOverlap(
              entries[i].start_time,
              entries[i].end_time,
              entries[j].start_time,
              entries[j].end_time
            )
          ) {
            throw new AppError(
              `Batch conflict: '${entries[i].subject_name}' overlaps with '${entries[j].subject_name}' on ${entries[i].day_of_week}`,
              'CONFLICT',
              409
            );
          }
        }
      }

      const entryPayloads = entries.map((entry) => ({
        timetable_id: timetable.id,
        day_of_week: entry.day_of_week,
        start_time: entry.start_time,
        end_time: entry.end_time,
        subject_name: entry.subject_name,
        subject_code: entry.subject_code ?? null,
        faculty_name: entry.faculty_name ?? null,
        room: entry.room ?? null,
        class_type: entry.class_type ?? 'lecture',
        section: entry.section ?? null,
        notes: entry.notes ?? null,
      }));

      const { data: inserted, error: entriesError } = await this.supabase
        .from('timetable_entries')
        .insert(entryPayloads)
        .select('*');

      if (entriesError) {
        throw new AppError(`Failed to create timetable entries: ${entriesError.message}`, 'INTERNAL_ERROR', 500, entriesError);
      }

      insertedEntries = inserted || [];
    }

    return {
      ...timetable,
      entries: insertedEntries,
    };
  }

  /**
   * Updates timetable metadata. If activating, deactivates other user timetables.
   */
  async updateTimetable(
    userId: string,
    timetableId: string,
    updates: Partial<Omit<Timetable, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<Timetable> {
    // Verify ownership first
    await this.getTimetableById(userId, timetableId);

    if (updates.active) {
      await this.supabase
        .from('timetables')
        .update({ active: false })
        .eq('user_id', userId)
        .neq('id', timetableId);
    }

    const { data, error } = await this.supabase
      .from('timetables')
      .update(updates)
      .eq('id', timetableId)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error || !data) {
      throw new AppError(`Failed to update timetable: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data;
  }

  /**
   * Deletes a timetable and all cascade entries.
   */
  async deleteTimetable(userId: string, timetableId: string): Promise<void> {
    // Verify ownership first
    await this.getTimetableById(userId, timetableId);

    const { error } = await this.supabase
      .from('timetables')
      .delete()
      .eq('id', timetableId)
      .eq('user_id', userId);

    if (error) {
      throw new AppError(`Failed to delete timetable: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }
  }

  /**
   * Adds a single class slot to an existing timetable with conflict detection.
   */
  async addEntry(
    userId: string,
    timetableId: string,
    entryInput: CreateTimetableEntryInput
  ): Promise<TimetableEntry> {
    // Verify timetable ownership
    await this.getTimetableById(userId, timetableId);

    // Check conflict
    const conflict = await this.checkTimeConflict(
      timetableId,
      entryInput.day_of_week,
      entryInput.start_time,
      entryInput.end_time
    );

    if (conflict.hasConflict && conflict.conflictingEntry) {
      const c = conflict.conflictingEntry;
      throw new AppError(
        `Time conflict: Overlaps with existing class '${c.subject_name}' (${c.start_time.slice(0, 5)} - ${c.end_time.slice(0, 5)}) on ${c.day_of_week}`,
        'CONFLICT',
        409
      );
    }

    const { data: newEntry, error } = await this.supabase
      .from('timetable_entries')
      .insert({
        timetable_id: timetableId,
        day_of_week: entryInput.day_of_week,
        start_time: entryInput.start_time,
        end_time: entryInput.end_time,
        subject_name: entryInput.subject_name,
        subject_code: entryInput.subject_code ?? null,
        faculty_name: entryInput.faculty_name ?? null,
        room: entryInput.room ?? null,
        class_type: entryInput.class_type ?? 'lecture',
        section: entryInput.section ?? null,
        notes: entryInput.notes ?? null,
      })
      .select('*')
      .single();

    if (error || !newEntry) {
      throw new AppError(`Failed to add timetable entry: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return newEntry;
  }

  /**
   * Retrieves an individual class entry and verifies timetable ownership.
   */
  async getEntryById(
    userId: string,
    timetableId: string,
    entryId: string
  ): Promise<TimetableEntry> {
    // Verify timetable ownership
    await this.getTimetableById(userId, timetableId);

    const { data: entry, error } = await this.supabase
      .from('timetable_entries')
      .select('*')
      .eq('id', entryId)
      .eq('timetable_id', timetableId)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch timetable entry: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    if (!entry) {
      throw new NotFoundError('Class slot not found');
    }

    return entry;
  }

  /**
   * Updates an individual class entry with conflict detection.
   */
  async updateEntry(
    userId: string,
    timetableId: string,
    entryId: string,
    updates: Partial<CreateTimetableEntryInput>
  ): Promise<TimetableEntry> {
    // Verify entry exists and belongs to this timetable owned by user
    const existing = await this.getEntryById(userId, timetableId, entryId);

    const targetDay = updates.day_of_week ?? existing.day_of_week;
    const targetStart = updates.start_time ?? existing.start_time;
    const targetEnd = updates.end_time ?? existing.end_time;

    // Check conflict against other entries
    const conflict = await this.checkTimeConflict(
      timetableId,
      targetDay,
      targetStart,
      targetEnd,
      entryId
    );

    if (conflict.hasConflict && conflict.conflictingEntry) {
      const c = conflict.conflictingEntry;
      throw new AppError(
        `Time conflict: Overlaps with existing class '${c.subject_name}' (${c.start_time.slice(0, 5)} - ${c.end_time.slice(0, 5)}) on ${c.day_of_week}`,
        'CONFLICT',
        409
      );
    }

    const { data: updated, error } = await this.supabase
      .from('timetable_entries')
      .update({
        day_of_week: targetDay,
        start_time: targetStart,
        end_time: targetEnd,
        subject_name: updates.subject_name ?? existing.subject_name,
        subject_code: updates.subject_code !== undefined ? updates.subject_code : existing.subject_code,
        faculty_name: updates.faculty_name !== undefined ? updates.faculty_name : existing.faculty_name,
        room: updates.room !== undefined ? updates.room : existing.room,
        class_type: updates.class_type ?? existing.class_type,
        section: updates.section !== undefined ? updates.section : existing.section,
        notes: updates.notes !== undefined ? updates.notes : existing.notes,
      })
      .eq('id', entryId)
      .eq('timetable_id', timetableId)
      .select('*')
      .single();

    if (error || !updated) {
      throw new AppError(`Failed to update timetable entry: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return updated;
  }

  /**
   * Deletes an individual class entry.
   */
  async deleteEntry(
    userId: string,
    timetableId: string,
    entryId: string
  ): Promise<void> {
    // Verify ownership
    await this.getTimetableById(userId, timetableId);

    const { error } = await this.supabase
      .from('timetable_entries')
      .delete()
      .eq('id', entryId)
      .eq('timetable_id', timetableId);

    if (error) {
      throw new AppError(`Failed to delete timetable entry: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }
  }
}
