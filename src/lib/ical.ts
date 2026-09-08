/**
 * RFC 5545 Compliant iCalendar (.ics) Generator for ClassFlow.
 * Enables synchronization with Google Calendar, Apple Calendar, and Outlook.
 */

export interface ICalEventInput {
  uid: string;
  summary: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM or HH:MM:SS
  endDate: string;   // YYYY-MM-DD
  endTime: string;   // HH:MM or HH:MM:SS
  description?: string | null;
  location?: string | null;
  timezone?: string;
  alarmMinutesBefore?: number;
}

/**
 * Escapes characters per RFC 5545 Section 3.3.11:
 * Backslashes, semicolons, commas, and newlines must be escaped.
 */
export function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n/g, '\\n')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\n');
}

/**
 * Formats a date string (YYYY-MM-DD) and time (HH:MM or HH:MM:SS) into iCal local datetime format:
 * YYYYMMDDTHHMMSS
 */
export function formatICalDateTime(dateStr: string, timeStr: string): string {
  const cleanDate = dateStr.replace(/-/g, '');
  const cleanTime = timeStr.replace(/:/g, '').padEnd(6, '0').slice(0, 6);
  return `${cleanDate}T${cleanTime}`;
}

/**
 * Formats a Date object to UTC timestamp: YYYYMMDDTHHMMSSZ
 */
export function formatICalUtcTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Generates an RFC 5545 compliant VCALENDAR string.
 */
export function generateICalendar(
  calendarTitle: string,
  events: ICalEventInput[],
  timezone = 'Asia/Kolkata'
): string {
  const dtstamp = formatICalUtcTimestamp();
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ClassFlow//Academic Schedule Manager//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(calendarTitle)}`,
    `X-WR-TIMEZONE:${timezone}`,
  ];

  for (const event of events) {
    const dtstart = formatICalDateTime(event.startDate, event.startTime);
    const dtend = formatICalDateTime(event.endDate, event.endTime);

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;TZID=${event.timezone || timezone}:${dtstart}`);
    lines.push(`DTEND;TZID=${event.timezone || timezone}:${dtend}`);
    lines.push(`SUMMARY:${escapeICalText(event.summary)}`);

    if (event.location) {
      lines.push(`LOCATION:${escapeICalText(event.location)}`);
    }

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
    }

    // 15-minute prior reminder alarm
    const alarmMinutes = event.alarmMinutesBefore ?? 15;
    if (alarmMinutes > 0) {
      lines.push('BEGIN:VALARM');
      lines.push(`TRIGGER:-PT${alarmMinutes}M`);
      lines.push('ACTION:DISPLAY');
      lines.push(`DESCRIPTION:${escapeICalText(`Reminder: ${event.summary}`)}`);
      lines.push('END:VALARM');
    }

    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  // RFC 5545 requires CRLF line endings
  return lines.join('\r\n') + '\r\n';
}
