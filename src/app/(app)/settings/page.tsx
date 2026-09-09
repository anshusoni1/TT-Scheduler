'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings as SettingsIcon,
  ArrowLeft,
  User,
  GraduationCap,
  Calendar,
  Percent,
  Key,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
} from 'lucide-react';
import type { Profile, AcademicYear } from '@/types/database';
import type { ApiResponse } from '@/types/api';

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [feedUrl, setFeedUrl] = useState<string | null>(null);
  const [feedCreatedAt, setFeedCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedActionLoading, setFeedActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [college, setCollege] = useState('');
  const [course, setCourse] = useState('');
  const [branch, setBranch] = useState('');
  const [semester, setSemester] = useState<string>('');
  const [section, setSection] = useState('');
  const [timezone, setTimezone] = useState('Asia/Kolkata');
  const [attendanceTarget, setAttendanceTarget] = useState('75');

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);

      // Fetch profile & academic years
      const res = await fetch('/api/settings');
      const json: ApiResponse<{ profile: Profile; academicYears: AcademicYear[] }> = await res.json();

      if (!res.ok || !json.success) {
        const msg = !json.success && 'error' in json ? json.error.message : 'Failed to load settings';
        throw new Error(msg);
      }

      const p = json.data.profile;
      setProfile(p);
      setAcademicYears(json.data.academicYears);

      setName(p.name || '');
      setCollege(p.college || '');
      setCourse(p.course || '');
      setBranch(p.branch || '');
      setSemester(p.semester !== null ? String(p.semester) : '');
      setSection(p.section || '');
      setTimezone(p.timezone || 'Asia/Kolkata');
      setAttendanceTarget(String(p.attendance_target_percentage || 75));

      // Fetch calendar feed status
      const feedRes = await fetch('/api/schedule/feed');
      const feedJson: ApiResponse<{ feedUrl: string | null; token: string | null; createdAt: string | null }> =
        await feedRes.json();
      if (feedRes.ok && feedJson.success) {
        setFeedUrl(feedJson.data.feedUrl);
        setFeedCreatedAt(feedJson.data.createdAt);
      }
    } catch (err) {
      setErrorBanner((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorBanner(null);
      setSuccessBanner(null);

      const payload = {
        name: name.trim(),
        college: college.trim() || null,
        course: course.trim() || null,
        branch: branch.trim() || null,
        semester: semester ? parseInt(semester, 10) : null,
        section: section.trim() || null,
        timezone: timezone.trim() || 'Asia/Kolkata',
        attendance_target_percentage: parseFloat(attendanceTarget) || 75,
      };

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json: ApiResponse<Profile> = await res.json();
      if (!res.ok || !json.success) {
        const msg = !json.success && 'error' in json ? json.error.message : 'Failed to update profile settings';
        throw new Error(msg);
      }

      setProfile(json.data);
      setSuccessBanner('Settings updated successfully!');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      setErrorBanner((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFeed = async () => {
    try {
      setFeedActionLoading(true);
      setErrorBanner(null);
      const res = await fetch('/api/schedule/feed', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to generate calendar feed');
      }
      setFeedUrl(json.data.feedUrl);
      setFeedCreatedAt(json.data.createdAt);
      setSuccessBanner('iCalendar subscription feed generated!');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      setErrorBanner((err as Error).message);
    } finally {
      setFeedActionLoading(false);
    }
  };

  const handleRevokeFeed = async () => {
    if (!confirm('Are you sure you want to revoke this calendar feed URL? Existing subscriptions in Apple/Google Calendar will stop syncing.')) {
      return;
    }
    try {
      setFeedActionLoading(true);
      setErrorBanner(null);
      const res = await fetch('/api/schedule/feed', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || 'Failed to revoke calendar feed');
      }
      setFeedUrl(null);
      setFeedCreatedAt(null);
      setSuccessBanner('Calendar feed token revoked successfully.');
      setTimeout(() => setSuccessBanner(null), 4000);
    } catch (err) {
      setErrorBanner((err as Error).message);
    } finally {
      setFeedActionLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!feedUrl) return;
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-neutral-400 hover:text-neutral-200 transition-colors p-1 rounded-lg hover:bg-neutral-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20 text-violet-400">
                <SettingsIcon className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-100">Settings</h1>
                <p className="text-xs text-neutral-400">Academic profile, attendance policy & calendar feed</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="text-xs text-neutral-400 hover:text-neutral-200 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {/* Banners */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-red-200 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {successBanner && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-emerald-200 text-xs">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
            <Loader2 className="w-8 h-8 animate-spin text-violet-400 mb-3" />
            <p className="text-sm">Loading user settings...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Col (2 cols): Academic Profile Form */}
            <div className="lg:col-span-2 space-y-6">
              <form onSubmit={handleSaveProfile} className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-6">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
                  <div className="flex items-center gap-2">
                    <User className="w-5 h-5 text-violet-400" />
                    <h2 className="text-base font-semibold text-neutral-100">Student Profile</h2>
                  </div>
                  <span className="text-xs text-neutral-500 font-mono">PostgreSQL Verified</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">College / Institution</label>
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. Stanford University / IIT Delhi"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Degree / Program</label>
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. B.Tech, B.Sc, M.S."
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Branch / Major</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. Computer Science, Mechanical"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Current Semester</label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-neutral-300">Section / Group</label>
                    <input
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. CSE-A, Batch 2"
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 focus:outline-none focus:border-violet-500"
                    />
                  </div>
                </div>

                <div className="border-t border-neutral-800 pt-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Percent className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-semibold text-neutral-200">Attendance Requirement</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-neutral-300">
                        Target Percentage (%)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={50}
                          max={100}
                          step={1}
                          required
                          value={attendanceTarget}
                          onChange={(e) => setAttendanceTarget(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-indigo-500"
                        />
                        <span className="text-sm text-neutral-400 font-bold">%</span>
                      </div>
                      <p className="text-[11px] text-neutral-500">
                        Default is 75%. Safe cuts margin on the Attendance page is computed from this policy.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-neutral-300">Application Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                        <option value="UTC">UTC (+0:00)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                      </select>
                      <p className="text-[11px] text-neutral-500">
                        Used for today/next class determinations and calendar feeds.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-neutral-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl font-medium text-sm transition-colors shadow-lg shadow-violet-600/20"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save Profile Settings</span>
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Academic Years Context */}
              <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-neutral-200">Registered Academic Years</h3>
                  </div>
                  <Link
                    href="/calendar"
                    className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    Manage in Academic Calendar →
                  </Link>
                </div>

                {academicYears.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-3">
                    No academic years created yet. Create one via the Academic Calendar page to bind semester dates and holidays.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {academicYears.map((ay) => (
                      <div
                        key={ay.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-neutral-950 border border-neutral-800/80 text-xs"
                      >
                        <div>
                          <div className="font-medium text-neutral-200">{ay.name}</div>
                          <div className="text-neutral-500">
                            {ay.start_date} to {ay.end_date} {ay.semester ? `• Semester ${ay.semester}` : ''}
                          </div>
                        </div>
                        {ay.is_active ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[11px] font-medium">
                            Active Context
                          </span>
                        ) : (
                          <span className="text-neutral-500 text-[11px]">Archived</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Col (1 col): iCalendar Subscription Feed Card & Security info */}
            <div className="space-y-6">
              {/* Calendar Feed Card */}
              <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4">
                <div className="flex items-center gap-2 border-b border-neutral-800 pb-3">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-200">iCalendar Live Feed</h3>
                    <p className="text-[11px] text-neutral-500">RFC 5545 calendar subscription</p>
                  </div>
                </div>

                <p className="text-xs text-neutral-400 leading-relaxed">
                  Subscribe to your live academic schedule on Apple Calendar, Google Calendar, or Outlook. Changes to classes or holidays sync automatically with 15-min alerts.
                </p>

                {feedUrl ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
                        Subscription URL
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={feedUrl}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-neutral-300 focus:outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={copyToClipboard}
                          className="p-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl transition-colors shrink-0"
                          title="Copy subscription URL"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {feedCreatedAt && (
                        <p className="text-[10px] text-neutral-500">
                          Active token created on {new Date(feedCreatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        disabled={feedActionLoading}
                        onClick={handleGenerateFeed}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-neutral-800 hover:bg-neutral-700 disabled:opacity-50 text-neutral-200 text-xs rounded-xl font-medium transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>

                      <button
                        type="button"
                        disabled={feedActionLoading}
                        onClick={handleRevokeFeed}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 bg-red-950/40 hover:bg-red-900/60 border border-red-800/60 text-red-300 text-xs rounded-xl font-medium transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-3">
                    <p className="text-xs text-neutral-500">No active calendar subscription feed token.</p>
                    <button
                      type="button"
                      disabled={feedActionLoading}
                      onClick={handleGenerateFeed}
                      className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-medium transition-colors shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                    >
                      {feedActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Key className="w-4 h-4" />
                      )}
                      <span>Generate Subscription Feed URL</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Security & Ownership Card */}
              <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3 text-xs text-neutral-400">
                <div className="flex items-center gap-2 text-neutral-200 font-semibold">
                  <Shield className="w-4 h-4 text-violet-400" />
                  <span>Security & Ownership</span>
                </div>
                <p>
                  All profile, timetable, calendar, attendance, and document records are strictly isolated using PostgreSQL Row Level Security (RLS).
                </p>
                <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 font-mono text-[11px] text-neutral-500 space-y-1">
                  <div>User ID: {profile?.user_id?.slice(0, 16)}...</div>
                  <div>Security: Row-Level Enforced</div>
                  <div>AI Provider: Gemini 3.6 Flash (Server-Only)</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
