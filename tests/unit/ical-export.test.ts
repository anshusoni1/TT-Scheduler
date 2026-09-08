import { describe, it, expect } from 'vitest';
import {
  escapeICalText,
  formatICalDateTime,
  formatICalUtcTimestamp,
  generateICalendar,
  type ICalEventInput,
} from '@/lib/ical';

describe('iCalendar (RFC 5545) Exporter', () => {
  describe('escapeICalText', () => {
    it('escapes backslashes, semicolons, commas, and newlines', () => {
      const raw = 'Math 101, Section A; Prof \\ Dr. Smith\nBring notes\r\nand calculator';
      const escaped = escapeICalText(raw);
      expect(escaped).toBe('Math 101\\, Section A\\; Prof \\\\ Dr. Smith\\nBring notes\\nand calculator');
    });

    it('returns empty string if text is empty', () => {
      expect(escapeICalText('')).toBe('');
    });
  });

  describe('formatICalDateTime', () => {
    it('converts YYYY-MM-DD and HH:MM(:SS) to YYYYMMDDTHHMMSS format', () => {
      expect(formatICalDateTime('2026-09-15', '09:30')).toBe('20260915T093000');
      expect(formatICalDateTime('2026-12-01', '14:45:30')).toBe('20261201T144530');
    });
  });

  describe('formatICalUtcTimestamp', () => {
    it('formats a JavaScript Date object as UTC ISO basic format ending in Z', () => {
      const date = new Date('2026-09-07T12:00:00Z');
      expect(formatICalUtcTimestamp(date)).toBe('20260907T120000Z');
    });
  });

  describe('generateICalendar', () => {
    it('generates standard RFC 5545 envelope with headers and timezone', () => {
      const ics = generateICalendar('ClassFlow Schedule', [], 'Asia/Kolkata');

      expect(ics).toContain('BEGIN:VCALENDAR');
      expect(ics).toContain('VERSION:2.0');
      expect(ics).toContain('PRODID:-//ClassFlow//Academic Schedule Manager//EN');
      expect(ics).toContain('CALSCALE:GREGORIAN');
      expect(ics).toContain('METHOD:PUBLISH');
      expect(ics).toContain('X-WR-CALNAME:ClassFlow Schedule');
      expect(ics).toContain('X-WR-TIMEZONE:Asia/Kolkata');
      expect(ics).toContain('END:VCALENDAR');
    });

    it('formats VEVENT blocks with timing, UID, summary, location, description, and VALARM', () => {
      const events: ICalEventInput[] = [
        {
          uid: 'cf-class-123@classflow.local',
          summary: 'Database Systems (CS301)',
          description: 'Type: lecture\\nFaculty: Prof. Alan Turing',
          location: 'Lab 402',
          startDate: '2026-09-10',
          startTime: '09:00',
          endDate: '2026-09-10',
          endTime: '10:30',
        },
      ];

      const ics = generateICalendar('Fall Semester 2026', events, 'Asia/Kolkata');

      expect(ics).toContain('BEGIN:VEVENT');
      expect(ics).toContain('UID:cf-class-123@classflow.local');
      expect(ics).toContain('SUMMARY:Database Systems (CS301)');
      expect(ics).toContain('LOCATION:Lab 402');
      expect(ics).toContain('DESCRIPTION:Type: lecture\\\\nFaculty: Prof. Alan Turing');
      expect(ics).toContain('DTSTART;TZID=Asia/Kolkata:20260910T090000');
      expect(ics).toContain('DTEND;TZID=Asia/Kolkata:20260910T103000');
      expect(ics).toContain('BEGIN:VALARM');
      expect(ics).toContain('TRIGGER:-PT15M');
      expect(ics).toContain('ACTION:DISPLAY');
      expect(ics).toContain('DESCRIPTION:Reminder: Database Systems (CS301)');
      expect(ics).toContain('END:VALARM');
      expect(ics).toContain('END:VEVENT');
      expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    });

    it('handles multiple events sequentially with CRLF line delimiters', () => {
      const events: ICalEventInput[] = [
        {
          uid: 'event-1@classflow.local',
          summary: 'Algorithms Lecture',
          startDate: '2026-09-11',
          startTime: '10:00',
          endDate: '2026-09-11',
          endTime: '11:00',
        },
        {
          uid: 'event-2@classflow.local',
          summary: 'Operating Systems Lab',
          location: 'Lab 101',
          startDate: '2026-09-11',
          startTime: '14:00',
          endDate: '2026-09-11',
          endTime: '16:00',
        },
      ];

      const ics = generateICalendar('Weekly Schedule', events);
      const eventOccurrences = (ics.match(/BEGIN:VEVENT/g) || []).length;
      expect(eventOccurrences).toBe(2);
      expect(ics).toContain('UID:event-1@classflow.local');
      expect(ics).toContain('UID:event-2@classflow.local');
    });
  });
});
