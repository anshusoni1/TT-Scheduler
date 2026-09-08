# ClassFlow (TT Scheduler)

[🌐 Live Demo](https://classflow-rho-seven.vercel.app/)

ClassFlow is a modern, AI-powered academic scheduling platform built for students and educators. It automatically extracts and digitizes timetables and academic calendars from unstructured documents (images or PDFs) using the Gemini AI API, storing them securely in a Supabase PostgreSQL database.

## Features

- **AI-Powered Extraction**: Upload a photo or PDF of your college timetable or academic calendar. ClassFlow uses Gemini (Gemini 1.5 Flash / 3.5 Flash) to parse complex grid layouts, merged lab sessions, and academic events automatically.
- **Smart Validation**: The system flags overlapping classes, low-confidence extractions, and missing details (like room numbers or faculty) before you commit to the database.
- **Interactive Review**: A rich UI to manually adjust, add, or delete any misclassified class slots or calendar events.
- **Unified Dashboard**: View "Today's Classes", "Next Class", and upcoming academic events all in one clean interface.
- **Weekly Schedule View**: A comprehensive weekly grid and card view of your entire class schedule.
- **Authentication & Profiles**: Secure user authentication and profile management (timezone, college, branch, semester) powered by Supabase Auth.

## Tech Stack

- **Frontend**: Next.js 15 (App Router), React 19, Tailwind CSS, Lucide Icons
- **Backend**: Next.js API Routes, Supabase (PostgreSQL, Storage, Auth)
- **AI Integration**: `@google/genai` (Gemini API)
- **Testing**: Vitest, Puppeteer (E2E)
- **Tooling**: TypeScript, ESLint, PostCSS

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- A [Supabase](https://supabase.com/) account and project
- A [Google Gemini API Key](https://aistudio.google.com/)

### Environment Setup

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

3. Fill in your `.env.local` with your API keys:
   ```env
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXT_PUBLIC_DEFAULT_TIMEZONE=Asia/Kolkata
   GEMINI_API_KEY=your_gemini_api_key_here

   NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key_here
   
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_SECRET_KEY=your_supabase_secret_key_here
   ```

**Important:** Never commit `.env.local` to git, and never expose `SUPABASE_SECRET_KEY` or service-role credentials to client-side code.

### Database Setup

You need to push the database schema to your Supabase project.

```bash
npx supabase login
npx supabase link --project-ref your-project-id
npx supabase db push
```

*Note: The migrations will set up all the necessary tables for `profiles`, `documents`, `timetables`, `calendar_events`, and `document_processing_jobs` along with the appropriate Row Level Security (RLS) policies.*

### Running the Application

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to see the result.

## Usage

1. **Sign Up / Log In**: Create an account or log in.
2. **Upload Document**: Navigate to the Documents page and upload a picture of your class timetable or academic calendar.
3. **AI Processing**: Wait a few moments while Gemini analyzes the document structure and extracts the class slots.
4. **Review & Commit**: Review the extracted data. Fix any warnings (like missing rooms) and click "Confirm & Commit".
5. **Dashboard**: Your dashboard will now automatically track your active classes and upcoming schedule.

## Testing

ClassFlow includes unit tests and end-to-end (E2E) tests.

**Run unit tests:**
```bash
npm run test
```

**Run E2E tests (Puppeteer):**
```bash
# Ensure your dev server is running on localhost:3000
npx tsx e2e.ts
```

## License

This project is licensed under the MIT License.
