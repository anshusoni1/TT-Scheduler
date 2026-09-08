import type { EventType, ExceptionType } from '@/types/database';

export interface EventTypeMetadata {
  type: EventType;
  label: string;
  description: string;
  defaultIsHoliday: boolean;
  defaultIsTeachingDay: boolean;
  defaultAffectsRegularSchedule: boolean;
  badgeBg: string;
  badgeText: string;
  dotColor: string;
}

export const EVENT_TYPES: EventType[] = [
  'holiday',
  'teaching_day',
  'working_day',
  'exam',
  'special_event',
  'fest',
  'recess',
  'sports',
  'administrative',
  'special_teaching_day',
  'other',
];

export const EVENT_TYPE_METADATA: Record<EventType, EventTypeMetadata> = {
  holiday: {
    type: 'holiday',
    label: 'Holiday',
    description: 'Official non-working holiday; regular classes do not take place.',
    defaultIsHoliday: true,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: true,
    badgeBg: 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-900',
    badgeText: 'text-rose-700 dark:text-rose-300',
    dotColor: 'bg-rose-500',
  },
  teaching_day: {
    type: 'teaching_day',
    label: 'Teaching Day',
    description: 'Scheduled instructional teaching day.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: true,
    defaultAffectsRegularSchedule: true,
    badgeBg: 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    dotColor: 'bg-emerald-500',
  },
  working_day: {
    type: 'working_day',
    label: 'Working Day',
    description: 'Working day (e.g., working Saturday) with regular or designated classes.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: true,
    defaultAffectsRegularSchedule: true,
    badgeBg: 'bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900',
    badgeText: 'text-blue-700 dark:text-blue-300',
    dotColor: 'bg-blue-500',
  },
  exam: {
    type: 'exam',
    label: 'Examination',
    description: 'Mid-term, end-term, or practical exam session.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: true,
    badgeBg: 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900',
    badgeText: 'text-amber-700 dark:text-amber-300',
    dotColor: 'bg-amber-500',
  },
  special_event: {
    type: 'special_event',
    label: 'Special Academic Event',
    description: 'Guest lecture, symposium, workshop, or orientation.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: false,
    badgeBg: 'bg-purple-50 dark:bg-purple-950/60 border-purple-200 dark:border-purple-900',
    badgeText: 'text-purple-700 dark:text-purple-300',
    dotColor: 'bg-purple-500',
  },
  fest: {
    type: 'fest',
    label: 'College Fest',
    description: 'Cultural or technical college festival.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: true,
    badgeBg: 'bg-fuchsia-50 dark:bg-fuchsia-950/60 border-fuchsia-200 dark:border-fuchsia-900',
    badgeText: 'text-fuchsia-700 dark:text-fuchsia-300',
    dotColor: 'bg-fuchsia-500',
  },
  recess: {
    type: 'recess',
    label: 'Vacation / Recess',
    description: 'Semester break, winter/summer vacation, or preparatory leave.',
    defaultIsHoliday: true,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: true,
    badgeBg: 'bg-orange-50 dark:bg-orange-950/60 border-orange-200 dark:border-orange-900',
    badgeText: 'text-orange-700 dark:text-orange-300',
    dotColor: 'bg-orange-500',
  },
  sports: {
    type: 'sports',
    label: 'Sports Meet',
    description: 'Annual athletic or inter-college sports tournament.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: false,
    badgeBg: 'bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-900',
    badgeText: 'text-teal-700 dark:text-teal-300',
    dotColor: 'bg-teal-500',
  },
  administrative: {
    type: 'administrative',
    label: 'Administrative Day',
    description: 'Faculty meetings, grading deadlines, or registration.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: false,
    badgeBg: 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800',
    badgeText: 'text-slate-700 dark:text-slate-300',
    dotColor: 'bg-slate-400',
  },
  special_teaching_day: {
    type: 'special_teaching_day',
    label: 'Special Teaching Day',
    description: 'Instructional day with timetable overrides.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: true,
    defaultAffectsRegularSchedule: true,
    badgeBg: 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-900',
    badgeText: 'text-indigo-700 dark:text-indigo-300',
    dotColor: 'bg-indigo-500',
  },
  other: {
    type: 'other',
    label: 'Other Event',
    description: 'General academic calendar entry.',
    defaultIsHoliday: false,
    defaultIsTeachingDay: false,
    defaultAffectsRegularSchedule: false,
    badgeBg: 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    badgeText: 'text-slate-700 dark:text-slate-300',
    dotColor: 'bg-slate-400',
  },
};

export interface ExceptionTypeMetadata {
  type: ExceptionType;
  label: string;
  description: string;
}

export const EXCEPTION_TYPES: ExceptionType[] = [
  'cancelled',
  'rescheduled',
  'room_change',
  'substitute',
  'extra_class',
  'date_holiday',
  'date_teaching_day',
];

export const EXCEPTION_TYPE_METADATA: Record<ExceptionType, ExceptionTypeMetadata> = {
  cancelled: {
    type: 'cancelled',
    label: 'Class Cancelled',
    description: 'Specific class slot is cancelled for this single date only.',
  },
  rescheduled: {
    type: 'rescheduled',
    label: 'Class Rescheduled',
    description: 'Class is moved to a different time slot on this date.',
  },
  room_change: {
    type: 'room_change',
    label: 'Room Change',
    description: 'Class is held in a different room or laboratory on this date.',
  },
  substitute: {
    type: 'substitute',
    label: 'Substitute Faculty / Subject',
    description: 'Different instructor or subject topic for this date.',
  },
  extra_class: {
    type: 'extra_class',
    label: 'Extra / Makeup Class',
    description: 'An additional class slot added specifically for this date.',
  },
  date_holiday: {
    type: 'date_holiday',
    label: 'Single-Date Holiday',
    description: 'Overrides regular schedule to mark this single day as holiday.',
  },
  date_teaching_day: {
    type: 'date_teaching_day',
    label: 'Single-Date Teaching Day',
    description: 'Overrides calendar holiday to conduct classes on this single date.',
  },
};
