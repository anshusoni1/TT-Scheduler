import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { AcademicYearsRepository } from '@/server/repositories/academic-years.repository';
import { profileUpdateSchema } from '@/lib/validation';
import { AppError } from '@/lib/errors';

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const profilesRepo = new ProfilesRepository(supabase);
    let profile = await profilesRepo.getProfile(user.id);

    if (!profile) {
      // Auto-create default profile for authenticated user
      const defaultName = user.user_metadata?.name || user.email?.split('@')[0] || 'Student';
      profile = await profilesRepo.upsertProfile(user.id, {
        name: defaultName,
        timezone: 'Asia/Kolkata',
      });
    }

    // Also fetch academic years to allow selection of active academic context
    const academicYearRepo = new AcademicYearsRepository(supabase);
    const academicYears = await academicYearRepo.getAcademicYears(user.id);

    return NextResponse.json({
      success: true,
      data: {
        profile,
        academicYears,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: (error as Error).message } },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 }
      );
    }

    const body = await request.json();
    const parsed = profileUpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid profile data',
            details: parsed.error.flatten(),
          },
        },
        { status: 400 }
      );
    }

    const profilesRepo = new ProfilesRepository(supabase);
    const updated = await profilesRepo.updateProfile(user.id, parsed.data);

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: (error as Error).message } },
      { status: 500 }
    );
  }
}
