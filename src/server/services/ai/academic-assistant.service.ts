import { GoogleGenAI, type Content, type Part, type FunctionCall } from '@google/genai';
import type { TypedSupabaseClient } from '@/types/database';
import {
  SchedulingService,
  type TodayScheduleClass,
  type SynthesizedDaySchedule,
} from '@/server/services/scheduling.service';
import { AttendanceService } from '@/server/services/attendance.service';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { AcademicYearsRepository } from '@/server/repositories/academic-years.repository';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { AppError } from '@/lib/errors';

export interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantToolCallInfo {
  toolName: string;
  args: Record<string, unknown>;
  resultSummary: string;
}

export interface AssistantResponse {
  answer: string;
  toolsUsed: AssistantToolCallInfo[];
}

export class AcademicAssistantService {
  private client: GoogleGenAI | null = null;
  private readonly modelName: string;

  constructor(apiKey?: string, modelName = 'gemini-3.5-flash') {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (key) {
      this.client = new GoogleGenAI({ apiKey: key });
    }
    this.modelName = modelName;
  }

  private ensureClient(): GoogleGenAI {
    if (!this.client) {
      const key = process.env.GEMINI_API_KEY;
      if (!key) {
        throw new AppError(
          'Gemini API key is not configured in the server environment (GEMINI_API_KEY).',
          'AI_API_KEY_MISSING',
          503
        );
      }
      this.client = new GoogleGenAI({ apiKey: key });
    }
    return this.client;
  }

  /**
   * Controlled tool declarations available to Gemini
   */
  private getToolDeclarations() {
    return [
      {
        name: 'getTodaySchedule',
        description: "Retrieves the student's scheduled classes, holiday status, and teaching day status for today.",
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getNextClass',
        description: "Finds the student's next upcoming class today or in the earliest upcoming scheduled day.",
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getScheduleForRange',
        description:
          'Retrieves the synthesized day-by-day schedule for a specific date range, accounting for holidays, exceptions, and timetable slots.',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            fromDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format (e.g. 2026-09-07)',
            },
            toDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format (e.g. 2026-09-14)',
            },
          },
          required: ['fromDate', 'toDate'],
        },
      },
      {
        name: 'getUpcomingHolidays',
        description: 'Lists upcoming official holidays from the student academic calendar starting from today onwards.',
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getTeachingDays',
        description:
          'Calculates the total teaching days, elapsed teaching days, and remaining teaching days in the active semester/academic calendar.',
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'getSubjectSchedule',
        description:
          'Finds all weekly recurring slots, timings, rooms, and faculty for a specific subject name or subject code (e.g., DBMS, CS301, Operating Systems).',
        parametersJsonSchema: {
          type: 'object',
          properties: {
            subjectQuery: {
              type: 'string',
              description: 'Subject name or code to search for',
            },
          },
          required: ['subjectQuery'],
        },
      },
      {
        name: 'getAttendanceSummary',
        description:
          'Calculates the real attendance metrics: overall attendance percentage, evaluated classes, present/absent counts, safe cuts allowance, and per-subject breakdown.',
        parametersJsonSchema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Deterministic execution router for controlled tools
   */
  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    supabase: TypedSupabaseClient,
    userId: string
  ): Promise<{ data: unknown; summary: string }> {
    switch (toolName) {
      case 'getTodaySchedule': {
        const schedule = await SchedulingService.getTodaySchedule(supabase, userId);
        const classSummary = schedule.todayClasses
          .map(
            (c: TodayScheduleClass) =>
              `${c.start_time.slice(0, 5)}-${c.end_time.slice(0, 5)}: ${c.subject_name} (${c.room || 'No room'}) [${c.status}]`
          )
          .join(', ');
        return {
          data: schedule,
          summary: `Today is ${schedule.dayOfWeek} (${schedule.dateString}). Is holiday: ${schedule.isHoliday} (${schedule.holidayTitle || 'None'}). Scheduled classes: ${schedule.todayClasses.length > 0 ? classSummary : 'None'}.`,
        };
      }

      case 'getNextClass': {
        const schedule = await SchedulingService.getTodaySchedule(supabase, userId);
        const next = schedule.nextClass;
        if (!next) {
          return {
            data: null,
            summary: 'No upcoming class found in the schedule.',
          };
        }
        return {
          data: next,
          summary: `Next class: ${next.subject_name} on ${next.targetDay} (${next.targetDate || 'today'}) from ${next.start_time.slice(0, 5)} to ${next.end_time.slice(0, 5)} in ${next.room || 'TBD'} by ${next.faculty_name || 'Faculty'}.`,
        };
      }

      case 'getScheduleForRange': {
        const fromDate = String(args.fromDate || new Date().toISOString().slice(0, 10));
        const toDate = String(args.toDate || fromDate);
        const days = await SchedulingService.synthesizeScheduleForRange(supabase, userId, fromDate, toDate);
        const totalClasses = days.reduce((acc: number, d: SynthesizedDaySchedule) => acc + d.classes.length, 0);
        return {
          data: days,
          summary: `Schedule from ${fromDate} to ${toDate}: ${days.length} days retrieved, ${totalClasses} total scheduled classes.`,
        };
      }

      case 'getUpcomingHolidays': {
        const calendarsRepo = new CalendarsRepository(supabase);
        const activeCal = await calendarsRepo.getActiveCalendar(userId);
        if (!activeCal) {
          return { data: [], summary: 'No active academic calendar configured.' };
        }
        const todayStr = new Date().toISOString().slice(0, 10);
        const holidays = (activeCal.events || [])
          .filter((e) => e.event_type === 'holiday' && e.event_date >= todayStr)
          .sort((a, b) => a.event_date.localeCompare(b.event_date))
          .slice(0, 10);

        return {
          data: holidays,
          summary: `Found ${holidays.length} upcoming holidays: ${holidays.map((h) => `${h.title} on ${h.event_date}`).join('; ')}`,
        };
      }

      case 'getTeachingDays': {
        const academicRepo = new AcademicYearsRepository(supabase);
        const calendarsRepo = new CalendarsRepository(supabase);
        const [activeYear, activeCal] = await Promise.all([
          academicRepo.getActiveAcademicYear(userId),
          calendarsRepo.getActiveCalendar(userId),
        ]);
        if (!activeYear || !activeCal) {
          return {
            data: null,
            summary: 'Active academic year or calendar not set. Cannot compute teaching days.',
          };
        }
        const todayStr = new Date().toISOString().slice(0, 10);

        // Compute teaching days using scheduling service analytics
        const analytics = await SchedulingService.calculateAttendanceAnalytics(supabase, userId, 75).catch(
          () => null
        );
        const totalTeachingDays = analytics?.total_teaching_days ?? 0;
        const totalHolidays = analytics?.total_holidays ?? 0;

        return {
          data: {
            semester_start: activeYear.start_date,
            semester_end: activeYear.end_date,
            today: todayStr,
            totalTeachingDays,
            totalHolidays,
            activeAcademicYear: activeYear.name,
          },
          summary: `Academic Period: ${activeYear.start_date} to ${activeYear.end_date}. Total calculated teaching days: ${totalTeachingDays}, total holidays: ${totalHolidays}.`,
        };
      }

      case 'getSubjectSchedule': {
        const query = String(args.subjectQuery || '').trim().toLowerCase();
        const timetablesRepo = new TimetablesRepository(supabase);
        const activeTimetable = await timetablesRepo.getActiveTimetable(userId);
        if (!activeTimetable) {
          return { data: [], summary: 'No active timetable found.' };
        }
        const matchingEntries = activeTimetable.entries.filter(
          (e) =>
            e.subject_name.toLowerCase().includes(query) ||
            (e.subject_code && e.subject_code.toLowerCase().includes(query))
        );
        const slotSummary = matchingEntries
          .map(
            (e) =>
              `${e.day_of_week.toUpperCase()} at ${e.start_time.slice(0, 5)}-${e.end_time.slice(0, 5)} (Room: ${e.room || 'N/A'}, Faculty: ${e.faculty_name || 'N/A'})`
          )
          .join('; ');

        return {
          data: matchingEntries,
          summary: `Found ${matchingEntries.length} weekly slots for "${query}": ${slotSummary || 'None'}`,
        };
      }

      case 'getAttendanceSummary': {
        const overview = await AttendanceService.getAttendanceOverview(supabase, userId);
        const subjectsSummary = overview.subjects
          .map(
            (s) =>
              `${s.subject_name}: ${s.current_percentage}% (${s.present}/${s.present + s.absent} held, ${s.safe_cuts_remaining} safe cuts remaining)`
          )
          .join(' | ');

        return {
          data: overview,
          summary: `Overall Attendance: ${overview.overall_percentage}% (Target: ${overview.target_percentage}%). Status: ${overview.status.toUpperCase()}. Present: ${overview.present_count}, Absent: ${overview.absent_count}. Subjects: ${subjectsSummary}`,
        };
      }

      default:
        throw new AppError(`Unknown tool: ${toolName}`, 'INTERNAL_ERROR', 400);
    }
  }

  /**
   * Main conversational interface for students
   */
  async ask(
    userMessage: string,
    history: AssistantMessage[],
    supabase: TypedSupabaseClient,
    userId: string
  ): Promise<AssistantResponse> {
    const ai = this.ensureClient();

    // Fetch user profile for personal context
    const profilesRepo = new ProfilesRepository(supabase);
    const profile = await profilesRepo.getProfile(userId);
    const studentName = profile?.name || 'Student';
    const college = profile?.college || 'College';
    const timezone = profile?.timezone || 'Asia/Kolkata';
    const todayStr = new Date().toISOString().slice(0, 10);

    const systemInstruction = `You are the ClassFlow AI Academic Assistant for ${studentName} attending ${college}.
Today's Date: ${todayStr}
Timezone: ${timezone}

CRITICAL RULES:
1. NEVER fabricate, hallucinate, or assume timetable classes, timings, rooms, faculty, holidays, or attendance figures.
2. ALWAYS use the provided deterministic tools to fetch trusted data before answering schedule, holiday, next class, or attendance questions:
   - "What do I have today?" or "Classes today" -> call getTodaySchedule
   - "When is my next class?" -> call getNextClass
   - "What is my schedule for [date/week/tomorrow]?" -> call getScheduleForRange
   - "When is my next holiday?" -> call getUpcomingHolidays
   - "How many teaching days are left?" -> call getTeachingDays
   - "Do I have [Subject] this week?" or "Where is [Subject] class?" -> call getSubjectSchedule
   - "What is my attendance?" or "Can I bunk [Subject]?" -> call getAttendanceSummary
3. Present your answer concisely, clearly, and encouragingly in clean markdown with bullet points and bold text where appropriate.
4. If the student asks something outside academic schedules, answer politely or redirect them to their academic tools.`;

    const tools = [{ functionDeclarations: this.getToolDeclarations() }];

    // Format chat contents with typed Content[]
    const contents: Content[] = [];

    // Add previous history
    for (const msg of history.slice(-6)) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }

    // Add current user message
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }],
    });

    const toolsUsed: AssistantToolCallInfo[] = [];

    // First model generation
    const response = await ai.models.generateContent({
      model: this.modelName,
      contents,
      config: {
        systemInstruction,
        tools,
        temperature: 0.2,
      },
    });

    // Check if the model called any tools
    const functionCalls = response.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      // Execute each function call deterministically
      const functionResponseParts: Part[] = [];

      for (const call of functionCalls) {
        const toolName = call.name || '';
        const callArgs = (call.args as Record<string, unknown>) || {};

        const { data, summary } = await this.executeTool(toolName, callArgs, supabase, userId);

        toolsUsed.push({
          toolName,
          args: callArgs,
          resultSummary: summary,
        });

        functionResponseParts.push({
          functionResponse: {
            name: toolName,
            response: {
              output: data,
              summary,
            },
          },
        });
      }

      // Send tool results back to Gemini for final response synthesis
      const modelCallParts: Part[] = functionCalls.map((fc: FunctionCall) => ({
        functionCall: fc,
      }));

      const secondTurnContents: Content[] = [
        ...contents,
        {
          role: 'model',
          parts: modelCallParts,
        },
        {
          role: 'user',
          parts: functionResponseParts,
        },
      ];

      const finalResponse = await ai.models.generateContent({
        model: this.modelName,
        contents: secondTurnContents,
        config: {
          systemInstruction,
          temperature: 0.2,
        },
      });

      return {
        answer: finalResponse.text || 'Schedule data retrieved successfully.',
        toolsUsed,
      };
    }

    // Direct answer without tool call (e.g. general greeting)
    return {
      answer: response.text || 'How can I help you with your college schedule or attendance today?',
      toolsUsed,
    };
  }
}
