import type { AcademicCalendar, CalendarEvent, EventType, TypedSupabaseClient, Json } from '@/types/database';
import { NotFoundError, AppError, ForbiddenError } from '@/lib/errors';

export interface CalendarWithEvents extends AcademicCalendar {
  events: CalendarEvent[];
}

export interface CreateCalendarInput {
  academic_year_id?: string | null;
  name: string;
  effective_from: string;
  effective_to?: string | null;
  active?: boolean;
}

export interface CreateCalendarEventInput {
  event_date: string;
  event_type: EventType;
  title: string;
  description?: string | null;
  is_teaching_day?: boolean;
  is_holiday?: boolean;
  affects_regular_schedule?: boolean;
  metadata?: Record<string, unknown>;
}

export class CalendarsRepository {
  constructor(private readonly supabase: TypedSupabaseClient) {}

  async getActiveCalendar(userId: string): Promise<CalendarWithEvents | null> {
    const { data: calendar, error: calError } = await this.supabase
      .from('academic_calendars')
      .select('id, user_id, academic_year_id, name, effective_from, effective_to, active, created_at, updated_at')
      .eq('user_id', userId)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (calError) {
      throw new AppError(`Failed to fetch active calendar: ${calError.message}`, 'INTERNAL_ERROR', 500, calError);
    }

    if (!calendar) {
      return null;
    }

    const { data: events, error: eventsError } = await this.supabase
      .from('calendar_events')
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .eq('calendar_id', calendar.id)
      .order('event_date', { ascending: true });

    if (eventsError) {
      throw new AppError(`Failed to fetch calendar events: ${eventsError.message}`, 'INTERNAL_ERROR', 500, eventsError);
    }

    return {
      ...calendar,
      events: events || [],
    };
  }

  async getCalendarById(userId: string, calendarId: string): Promise<CalendarWithEvents> {
    const { data: calendar, error: calError } = await this.supabase
      .from('academic_calendars')
      .select('id, user_id, academic_year_id, name, effective_from, effective_to, active, created_at, updated_at')
      .eq('id', calendarId)
      .maybeSingle();

    if (calError) {
      throw new AppError(`Failed to fetch calendar: ${calError.message}`, 'INTERNAL_ERROR', 500, calError);
    }

    if (!calendar) {
      throw new NotFoundError('Academic calendar not found');
    }

    if (calendar.user_id !== userId) {
      throw new ForbiddenError('You do not have access to this calendar');
    }

    const { data: events, error: eventsError } = await this.supabase
      .from('calendar_events')
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .eq('calendar_id', calendar.id)
      .order('event_date', { ascending: true });

    if (eventsError) {
      throw new AppError(`Failed to fetch calendar events: ${eventsError.message}`, 'INTERNAL_ERROR', 500, eventsError);
    }

    return {
      ...calendar,
      events: events || [],
    };
  }

  async createCalendar(
    userId: string,
    calendarData: CreateCalendarInput,
    events: CreateCalendarEventInput[] = []
  ): Promise<CalendarWithEvents> {
    if (calendarData.active) {
      // Deactivate other active calendars
      await this.supabase
        .from('academic_calendars')
        .update({ active: false })
        .eq('user_id', userId);
    }

    const { data: calendar, error: calError } = await this.supabase
      .from('academic_calendars')
      .insert({
        user_id: userId,
        academic_year_id: calendarData.academic_year_id ?? null,
        name: calendarData.name,
        effective_from: calendarData.effective_from,
        effective_to: calendarData.effective_to ?? null,
        active: calendarData.active ?? true,
      })
      .select('id, user_id, academic_year_id, name, effective_from, effective_to, active, created_at, updated_at')
      .single();

    if (calError || !calendar) {
      throw new AppError(`Failed to create calendar: ${calError?.message}`, 'INTERNAL_ERROR', 500, calError);
    }

    let insertedEvents: CalendarEvent[] = [];

    if (events.length > 0) {
      const eventPayloads = events.map((event) => ({
        calendar_id: calendar.id,
        event_date: event.event_date,
        event_type: event.event_type,
        title: event.title,
        description: event.description ?? null,
        is_teaching_day: event.is_teaching_day ?? false,
        is_holiday: event.is_holiday ?? false,
        affects_regular_schedule: event.affects_regular_schedule ?? true,
        metadata: (event.metadata ?? {}) as Json,
      }));

      const { data: inserted, error: eventsError } = await this.supabase
        .from('calendar_events')
        .insert(eventPayloads)
        .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at');

      if (eventsError) {
        throw new AppError(`Failed to insert calendar events: ${eventsError.message}`, 'INTERNAL_ERROR', 500, eventsError);
      }

      insertedEvents = inserted || [];
    }

    return {
      ...calendar,
      events: insertedEvents,
    };
  }

  async updateCalendar(
    userId: string,
    calendarId: string,
    updates: Partial<Omit<AcademicCalendar, 'id' | 'user_id' | 'created_at' | 'updated_at'>>
  ): Promise<AcademicCalendar> {
    const { data, error } = await this.supabase
      .from('academic_calendars')
      .update(updates)
      .eq('id', calendarId)
      .eq('user_id', userId)
      .select('id, user_id, academic_year_id, name, effective_from, effective_to, active, created_at, updated_at')
      .single();

    if (error) {
      throw new AppError(`Failed to update calendar: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    if (!data) {
      throw new NotFoundError('Academic calendar not found');
    }

    return data;
  }

  async deleteCalendar(userId: string, calendarId: string): Promise<void> {
    const { error } = await this.supabase
      .from('academic_calendars')
      .delete()
      .eq('id', calendarId)
      .eq('user_id', userId);

    if (error) {
      throw new AppError(`Failed to delete calendar: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }
  }

  async getUserCalendars(userId: string): Promise<CalendarWithEvents[]> {
    const { data: calendars, error: calError } = await this.supabase
      .from('academic_calendars')
      .select('id, user_id, academic_year_id, name, effective_from, effective_to, active, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (calError) {
      throw new AppError(`Failed to fetch calendars: ${calError.message}`, 'INTERNAL_ERROR', 500, calError);
    }

    const results: CalendarWithEvents[] = [];
    for (const cal of calendars || []) {
      const { data: events, error: evError } = await this.supabase
        .from('calendar_events')
        .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
        .eq('calendar_id', cal.id)
        .order('event_date', { ascending: true });

      if (evError) {
        throw new AppError(`Failed to fetch calendar events: ${evError.message}`, 'INTERNAL_ERROR', 500, evError);
      }

      results.push({
        ...cal,
        events: events || [],
      });
    }

    return results;
  }

  async getEventById(userId: string, calendarId: string, eventId: string): Promise<CalendarEvent> {
    // Verify calendar ownership first
    await this.getCalendarById(userId, calendarId);

    const { data: event, error } = await this.supabase
      .from('calendar_events')
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .eq('id', eventId)
      .eq('calendar_id', calendarId)
      .maybeSingle();

    if (error) {
      throw new AppError(`Failed to fetch event: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    if (!event) {
      throw new NotFoundError('Calendar event not found');
    }

    return event;
  }

  async getEventsForDate(userId: string, date: string): Promise<CalendarEvent[]> {
    const activeCalendar = await this.getActiveCalendar(userId);
    if (!activeCalendar) return [];

    const { data, error } = await this.supabase
      .from('calendar_events')
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .eq('calendar_id', activeCalendar.id)
      .eq('event_date', date);

    if (error) {
      throw new AppError(`Failed to fetch events for date: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  async addEvent(
    userId: string,
    calendarId: string,
    eventInput: CreateCalendarEventInput
  ): Promise<CalendarEvent> {
    // Verify calendar ownership
    await this.getCalendarById(userId, calendarId);

    const { data: event, error } = await this.supabase
      .from('calendar_events')
      .insert({
        calendar_id: calendarId,
        event_date: eventInput.event_date,
        event_type: eventInput.event_type,
        title: eventInput.title,
        description: eventInput.description ?? null,
        is_teaching_day: eventInput.is_teaching_day ?? false,
        is_holiday: eventInput.is_holiday ?? false,
        affects_regular_schedule: eventInput.affects_regular_schedule ?? true,
        metadata: (eventInput.metadata ?? {}) as Json,
      })
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .single();

    if (error || !event) {
      throw new AppError(`Failed to add calendar event: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return event;
  }

  async updateEvent(
    userId: string,
    calendarId: string,
    eventId: string,
    updates: Partial<CreateCalendarEventInput>
  ): Promise<CalendarEvent> {
    // Verify calendar and event ownership
    await this.getEventById(userId, calendarId, eventId);

    const updatePayload: Record<string, unknown> = {};
    if (updates.event_date !== undefined) updatePayload.event_date = updates.event_date;
    if (updates.event_type !== undefined) updatePayload.event_type = updates.event_type;
    if (updates.title !== undefined) updatePayload.title = updates.title;
    if (updates.description !== undefined) updatePayload.description = updates.description;
    if (updates.is_teaching_day !== undefined) updatePayload.is_teaching_day = updates.is_teaching_day;
    if (updates.is_holiday !== undefined) updatePayload.is_holiday = updates.is_holiday;
    if (updates.affects_regular_schedule !== undefined) {
      updatePayload.affects_regular_schedule = updates.affects_regular_schedule;
    }
    if (updates.metadata !== undefined) updatePayload.metadata = updates.metadata;

    const { data: updated, error } = await this.supabase
      .from('calendar_events')
      .update(updatePayload)
      .eq('id', eventId)
      .eq('calendar_id', calendarId)
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .single();

    if (error || !updated) {
      throw new AppError(`Failed to update calendar event: ${error?.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return updated;
  }

  async deleteEvent(userId: string, calendarId: string, eventId: string): Promise<void> {
    // Verify calendar and event ownership
    await this.getEventById(userId, calendarId, eventId);

    const { error } = await this.supabase
      .from('calendar_events')
      .delete()
      .eq('id', eventId)
      .eq('calendar_id', calendarId);

    if (error) {
      throw new AppError(`Failed to delete calendar event: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }
  }

  async getUpcomingHolidays(userId: string, fromDate: string, limit = 5): Promise<CalendarEvent[]> {
    const activeCalendar = await this.getActiveCalendar(userId);
    if (!activeCalendar) return [];

    const { data, error } = await this.supabase
      .from('calendar_events')
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .eq('calendar_id', activeCalendar.id)
      .eq('is_holiday', true)
      .gte('event_date', fromDate)
      .order('event_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new AppError(`Failed to fetch upcoming holidays: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }

  async getUpcomingEvents(userId: string, fromDate: string, limit = 5): Promise<CalendarEvent[]> {
    const activeCalendar = await this.getActiveCalendar(userId);
    if (!activeCalendar) return [];

    const { data, error } = await this.supabase
      .from('calendar_events')
      .select('id, calendar_id, event_date, event_type, title, description, is_teaching_day, is_holiday, affects_regular_schedule, metadata, created_at, updated_at')
      .eq('calendar_id', activeCalendar.id)
      .gte('event_date', fromDate)
      .order('event_date', { ascending: true })
      .limit(limit);

    if (error) {
      throw new AppError(`Failed to fetch upcoming events: ${error.message}`, 'INTERNAL_ERROR', 500, error);
    }

    return data || [];
  }
}
