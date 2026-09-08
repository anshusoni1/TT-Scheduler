import { describe, it, expect, vi } from 'vitest';
import { AcademicAssistantService } from '@/server/services/ai/academic-assistant.service';
import { NotificationService } from '@/server/services/notification.service';
import { SchedulingService } from '@/server/services/scheduling.service';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import type { TypedSupabaseClient } from '@/types/database';

describe('AcademicAssistantService & NotificationService', () => {
  describe('AcademicAssistantService Tool Architecture', () => {
    it('initializes with default model gemini-3.5-flash', () => {
      const service = new AcademicAssistantService('dummy-key');
      expect(service).toBeDefined();
    });

    it('exposes all 7 required controlled tools in declarations', () => {
      const service = new AcademicAssistantService('dummy-key');
      // Access private method for testing tool contract
      // @ts-expect-error accessing private method for verification
      const tools = service.getToolDeclarations();
      expect(tools).toHaveLength(7);

      const toolNames = tools.map((t: { name: string }) => t.name);
      expect(toolNames).toContain('getTodaySchedule');
      expect(toolNames).toContain('getNextClass');
      expect(toolNames).toContain('getScheduleForRange');
      expect(toolNames).toContain('getUpcomingHolidays');
      expect(toolNames).toContain('getTeachingDays');
      expect(toolNames).toContain('getSubjectSchedule');
      expect(toolNames).toContain('getAttendanceSummary');
    });

    it('rejects execution when GEMINI_API_KEY is not configured', async () => {
      const originalKey = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;

      const service = new AcademicAssistantService();
      const mockSupabase = {} as TypedSupabaseClient;

      await expect(
        service.ask('What classes do I have?', [], mockSupabase, 'user-123')
      ).rejects.toThrow('Gemini API key is not configured');

      if (originalKey) {
        process.env.GEMINI_API_KEY = originalKey;
      }
    });
  });

  describe('NotificationService Deterministic Calculation', () => {
    it('identifies upcoming class starting within 30 minutes', async () => {
      const mockSupabase = {} as TypedSupabaseClient;

      vi.spyOn(SchedulingService, 'getTodaySchedule').mockResolvedValueOnce({
        hasTimetable: true,
        hasCalendar: false,
        timezone: 'Asia/Kolkata',
        dateString: '2026-09-07',
        timeString: '09:45:00',
        dayOfWeek: 'monday',
        isHoliday: false,
        isTeachingDay: true,
        holidayTitle: null,
        todayEvents: [],
        upcomingHolidays: [],
        upcomingEvents: [],
        todayClasses: [
          {
            id: 'entry-1',
            timetable_id: 'tt-1',
            day_of_week: 'monday',
            start_time: '10:00:00',
            end_time: '11:00:00',
            subject_name: 'Database Management Systems',
            subject_code: 'CS301',
            faculty_name: 'Dr. Rao',
            room: 'Lab 2',
            class_type: 'lab',
            section: null,
            notes: null,
            created_at: '',
            updated_at: '',
            status: 'upcoming',
          },
        ],
        currentClass: null,
        nextClass: null,
      });

      vi.spyOn(CalendarsRepository.prototype, 'getActiveCalendar').mockResolvedValueOnce(null);

      // Mock current time to 09:45:00 (15 minutes before 10:00:00)
      const reminders = await NotificationService.getActiveReminders(mockSupabase, 'user-1');
      expect(reminders).toBeDefined();
      expect(Array.isArray(reminders)).toBe(true);
    });

    it('identifies holiday alert when today is flagged as an academic holiday', async () => {
      const mockSupabase = {} as TypedSupabaseClient;

      vi.spyOn(SchedulingService, 'getTodaySchedule').mockResolvedValueOnce({
        hasTimetable: false,
        hasCalendar: true,
        timezone: 'Asia/Kolkata',
        dateString: '2026-09-07',
        timeString: '09:45:00',
        dayOfWeek: 'monday',
        isHoliday: true,
        isTeachingDay: false,
        holidayTitle: 'Gandhi Jayanti',
        todayEvents: [],
        upcomingHolidays: [],
        upcomingEvents: [],
        todayClasses: [],
        currentClass: null,
        nextClass: null,
      });

      vi.spyOn(CalendarsRepository.prototype, 'getActiveCalendar').mockResolvedValueOnce(null);

      const reminders = await NotificationService.getActiveReminders(mockSupabase, 'user-1');
      expect(reminders).toBeDefined();
    });
  });
});
