import type { DayOfWeek } from '@/types/database';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

/**
 * Converts a time string (HH:MM or HH:MM:SS) into total minutes from midnight.
 */
export function timeToMinutes(timeStr: string): number {
  const parts = timeStr.split(':').map((p) => parseInt(p, 10));
  const hours = parts[0] || 0;
  const minutes = parts[1] || 0;
  return hours * 60 + minutes;
}

/**
 * Checks if two time intervals overlap.
 * Assumes start < end for each interval.
 * Overlap occurs if startA < endB and endA > startB.
 */
export function doTimesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const aStart = timeToMinutes(startA);
  const aEnd = timeToMinutes(endA);
  const bStart = timeToMinutes(startB);
  const bEnd = timeToMinutes(endB);

  return aStart < bEnd && aEnd > bStart;
}

/**
 * Returns the current date, time, and day of week for a given IANA timezone.
 * Defaults to Asia/Kolkata if timezone is invalid or unspecified.
 */
export function getCurrentDateTimeInTimezone(
  timezone = 'Asia/Kolkata',
  referenceDate = new Date()
): {
  dateString: string; // YYYY-MM-DD
  timeString: string; // HH:MM:SS
  timeHM: string;     // HH:MM
  dayOfWeek: DayOfWeek;
  currentTimeMinutes: number;
} {
  let validTimezone = timezone;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    validTimezone = 'Asia/Kolkata';
  }

  // Format parts in target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: validTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(referenceDate);
  const getPart = (type: Intl.DateTimeFormatPartTypes): string => {
    return parts.find((p) => p.type === type)?.value || '';
  };

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  let hour = getPart('hour');
  // Handle 24:00 edge case in some node versions
  if (hour === '24') hour = '00';
  const minute = getPart('minute');
  const second = getPart('second');
  const weekdayStr = getPart('weekday').toLowerCase();

  const dayOfWeek = (
    DAYS_OF_WEEK.includes(weekdayStr as DayOfWeek) ? weekdayStr : 'monday'
  ) as DayOfWeek;

  const dateString = `${year}-${month}-${day}`;
  const timeString = `${hour}:${minute}:${second}`;
  const timeHM = `${hour}:${minute}`;

  return {
    dateString,
    timeString,
    timeHM,
    dayOfWeek,
    currentTimeMinutes: timeToMinutes(timeHM),
  };
}

/**
 * Returns the sequence of subsequent days of the week starting from the day after currentDay.
 * For example, if currentDay is 'monday', returns ['tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].
 */
export function getNextDaysOfWeek(currentDay: DayOfWeek): DayOfWeek[] {
  const currentIndex = DAYS_OF_WEEK.indexOf(currentDay);
  const nextDays: DayOfWeek[] = [];

  for (let i = 1; i <= 6; i++) {
    const nextIndex = (currentIndex + i) % 7;
    nextDays.push(DAYS_OF_WEEK[nextIndex]);
  }

  return nextDays;
}

/**
 * Generates an array of YYYY-MM-DD date strings between startDate and endDate (inclusive).
 */
export function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const curr = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  while (curr <= end) {
    dates.push(curr.toISOString().slice(0, 10));
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return dates;
}

/**
 * Offsets a YYYY-MM-DD date string by a given number of days (+/-).
 */
export function addDaysToDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Calculates the Monday-to-Sunday week range enclosing a given date.
 */
export function getWeekRangeForDate(dateStr: string): {
  startOfWeek: string;
  endOfWeek: string;
  dates: string[];
} {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const startOfWeek = monday.toISOString().slice(0, 10);
  const endOfWeek = sunday.toISOString().slice(0, 10);

  return {
    startOfWeek,
    endOfWeek,
    dates: getDatesBetween(startOfWeek, endOfWeek),
  };
}
