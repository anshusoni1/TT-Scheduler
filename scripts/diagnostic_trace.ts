import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("GEMINI_API_KEY is missing");
  process.exit(1);
}

const client = new GoogleGenAI({ apiKey });
const modelName = 'gemini-3.5-flash'; // As in the provider

async function runDiagnostic(name: string, pdfPath: string, prompt: string) {
  console.log(`\n========================================================`);
  console.log(`DIAGNOSTIC TRACE FOR: ${name}`);
  console.log(`========================================================`);
  
  const buffer = fs.readFileSync(pdfPath);
  console.log(`- File read: ${buffer.length} bytes`);
  
  try {
    const response = await client.models.generateContent({
      model: modelName,
      contents: [
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: 'application/pdf',
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });
    
    const text = response.text || '';
    console.log(`\n--- RAW GEMINI RESPONSE ---`);
    console.log(text);
    console.log(`--- END RAW RESPONSE ---\n`);
    
    if (!text) {
      console.log(`JSON PARSE: FAILED (Empty response)`);
      return;
    }
    
    try {
      const parsed = JSON.parse(text);
      console.log(`JSON PARSE: SUCCESS`);
      if (parsed.entries) {
        console.log(`ARRAY ENTRIES COUNT: ${parsed.entries.length}`);
      } else if (parsed.events) {
        console.log(`ARRAY EVENTS COUNT: ${parsed.events.length}`);
      }
    } catch (e: any) {
      console.error(`JSON PARSE: FAILED (${e.message})`);
    }

  } catch (err: any) {
    console.error(`API CALL FAILED: ${err.message}`);
  }
}

const classificationPrompt = `
You are an expert academic document classifier for college students.
Analyze this uploaded document image/PDF and classify its type.

Return JSON in this EXACT schema:
{
  "document_type": "timetable" | "calendar" | "mixed" | "unknown",
  "confidence": number between 0.0 and 1.0,
  "reasoning": "brief explanation of why this classification was chosen"
}

CLASSIFICATION RULES:
- "timetable": A weekly recurring class schedule with days of week (Mon-Fri/Sat), time slots, subjects, rooms, faculty. Even a partial screenshot or an image of a handwritten/printed timetable should be accepted.
- "calendar": An academic calendar listing dates/months with semester terms, holidays, teaching days, exam dates, recess, fests.
- "mixed": A document containing both a complete timetable and an academic calendar schedule.
- "unknown": Only use this if the document is COMPLETELY illegible, or completely unrelated to schedules/calendars. Be generous - if it looks like a schedule of classes, call it a timetable.
CRITICAL: Never classify only from filenames. Inspect the visual table layouts and textual content.
`;

const timetablePrompt = `
You are a precision academic timetable extraction engine.
Carefully inspect this college timetable document. It may have any arbitrary layout:
- Days as rows OR days as columns
- Time periods / hours as column headers OR row headers
- Merged multi-hour slots (e.g. 2-hour or 3-hour Labs/Practicals)
- Empty periods, lunch breaks, recess, library, or sports slots (do NOT extract lunch/recess as classes)
- Abbreviated subject codes (e.g. "DSA", "OS", "MATH-III") and full names
- Faculty initials (e.g. "Dr. AK", "Prof. RKS")
- Room numbers / Lab numbers (e.g. "L-204", "Lab 3", "Auditorium")

CRITICAL EXTRACTION RULES:
1. DO NOT INVENT or hallucinate missing information. If a room or faculty is not visible, use null.
2. If a slot or time is partially illegible, extract what is visible, use null where missing, and add an explanation in "warnings".
3. Normalize all times to 24-hour "HH:MM" format (e.g. "09:00", "14:30"). If the document says "9:00 AM - 10:00 AM", output start_time "09:00" and end_time "10:00".
4. If a class spans multiple consecutive periods (e.g., Lab 2:00 PM to 5:00 PM), represent it as a single entry with start_time "14:00" and end_time "17:00", class_type "lab".
5. Valid day_of_week must be lowercase: "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday".
6. Valid class_type must be one of: "lecture", "lab", "tutorial", "seminar", "other".
7. Assign an extraction confidence between 0.0 and 1.0 for each entry and for the overall document.
8. If there are ambiguities, add explicit warnings in the "warnings" array (e.g. "Room number partially blurred", "Ambiguous section code").

Return JSON in this EXACT schema:
{
  "academic_year": string or null,
  "semester": number (e.g. 5) or null,
  "section": string (e.g. "A") or null,
  "branch": string (e.g. "Computer Science & Engineering") or null,
  "timezone": "Asia/Kolkata",
  "timetable_title": string,
  "confidence": number between 0.0 and 1.0,
  "warnings": string[],
  "entries": [
    {
      "day_of_week": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "subject_name": string,
      "subject_code": string or null,
      "faculty_name": string or null,
      "room": string or null,
      "class_type": "lecture" | "lab" | "tutorial" | "seminar" | "other",
      "section": string or null,
      "notes": string or null,
      "confidence": number between 0.0 and 1.0,
      "warnings": string[]
    }
  ]
}
`;

const calendarPrompt = `
You are a precision academic calendar extraction engine.
Carefully inspect this college academic calendar document.
Extract all key academic dates, holidays, instructional periods, working Saturdays, and exams.

CRITICAL RULES:
1. Valid event_date must be in strict "YYYY-MM-DD" format. If only day and month are given, infer year from document header; if year is genuinely ambiguous, flag in "warnings".
2. Event types must be one of:
   - "holiday": Gazetted / festival / institutional holiday (set is_holiday: true, is_teaching_day: false).
   - "teaching_day": Regular instructional teaching day (set is_teaching_day: true, is_holiday: false).
   - "working_day": Compensatory or working Saturday (set is_teaching_day: true, is_holiday: false). If document mentions "Follows Monday timetable" or similar, include {"follows_day": "monday"} in metadata.
   - "exam": Midterm, endterm, practical examinations.
   - "special_event": Convocation, orientation, seminar.
   - "fest": College cultural / tech festival.
   - "recess": Vacation, semester break, study break.
   - "sports": Sports meet.
   - "administrative": Fee payment, registration, result announcement.
   - "other": Other academic event.
3. DO NOT INVENT dates. If an event has multiple dates or a date range (e.g. Oct 10 to Oct 12), output an entry for each date or the start date with description specifying the range.
4. Assign an extraction confidence between 0.0 and 1.0.

Return JSON in this EXACT schema:
{
  "academic_year": string or null,
  "calendar_title": string,
  "effective_from": "YYYY-MM-DD",
  "effective_to": "YYYY-MM-DD" or null,
  "confidence": number between 0.0 and 1.0,
  "warnings": string[],
  "events": [
    {
      "event_date": "YYYY-MM-DD",
      "event_type": "holiday" | "teaching_day" | "working_day" | "exam" | "special_event" | "fest" | "recess" | "sports" | "administrative" | "special_teaching_day" | "other",
      "title": string,
      "description": string or null,
      "is_teaching_day": boolean,
      "is_holiday": boolean,
      "affects_regular_schedule": boolean,
      "metadata": object,
      "confidence": number between 0.0 and 1.0,
      "warnings": string[]
    }
  ]
}
`;

async function main() {
  await runDiagnostic('TIMETABLE CLASSIFICATION', './tests/fixtures/test_timetable.pdf', classificationPrompt);
  await runDiagnostic('TIMETABLE EXTRACTION', './tests/fixtures/test_timetable.pdf', timetablePrompt);
  await runDiagnostic('CALENDAR CLASSIFICATION', './tests/fixtures/test_academic_calendar.pdf', classificationPrompt);
  await runDiagnostic('CALENDAR EXTRACTION', './tests/fixtures/test_academic_calendar.pdf', calendarPrompt);
}

main().catch(console.error);
