'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
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
  const [, setProfile] = useState<Profile | null>(null);
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
    <div className="flex flex-col">
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 space-y-10">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
            Settings
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mt-2 text-sm font-medium">
            Manage your profile, attendance preferences and calendar settings.
          </p>
        </div>

        {/* Banners */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-coral-50 border border-coral-200 text-coral-700 text-sm flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-coral-500 shrink-0" />
              <span className="font-medium">{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="text-coral-500 hover:text-coral-700 text-xs font-bold uppercase tracking-wider">
              Dismiss
            </button>
          </div>
        )}

        {successBanner && (
          <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-coral-400 shrink-0" />
              <span className="font-medium">{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold uppercase tracking-wider">
              Dismiss
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-coral-500 mb-3" />
            <p className="text-sm font-medium">Loading settings...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Col (2 cols): Academic Profile Form & Attendance */}
            <div className="lg:col-span-2 space-y-8">
              
              <form onSubmit={handleSaveProfile} className="p-6 md:p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <User className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100 tracking-tight">Student Profile</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">College / Institution</label>
                    <input
                      type="text"
                      value={college}
                      onChange={(e) => setCollege(e.target.value)}
                      placeholder="e.g. Stanford University"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Degree / Program</label>
                    <input
                      type="text"
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="e.g. B.Tech, B.Sc"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Branch / Major</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={(e) => setBranch(e.target.value)}
                      placeholder="e.g. Computer Science"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Current Semester</label>
                    <input
                      type="number"
                      min={1}
                      max={16}
                      value={semester}
                      onChange={(e) => setSemester(e.target.value)}
                      placeholder="e.g. 5"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Section / Group</label>
                    <input
                      type="text"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      placeholder="e.g. CSE-A"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors"
                    />
                  </div>
                </div>

                {/* Attendance Requirement integrated into form */}
                <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3 mb-6">
                    <Percent className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100 tracking-tight">Attendance Requirement</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
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
                          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors"
                        />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        We use this to calculate how many classes you can miss safely.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Application Timezone</label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-coral-500/20 focus:border-coral-500 transition-colors appearance-none"
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST +5:30)</option>
                        <option value="UTC">UTC (+0:00)</option>
                        <option value="America/New_York">America/New_York (EST)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST +4:00)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT +8:00)</option>
                      </select>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Ensures your classes appear at the right time.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end pt-6 border-t border-slate-200 dark:border-slate-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 bg-coral-400 hover:bg-coral-500 disabled:opacity-50 text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
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
              <div className="p-6 md:p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <GraduationCap className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100 tracking-tight">Registered Academic Years</h3>
                  </div>
                  <Link
                    href="/calendar"
                    className="text-xs font-bold text-coral-500 hover:text-coral-600 transition-colors uppercase tracking-wider"
                  >
                    Manage →
                  </Link>
                </div>

                {academicYears.length === 0 ? (
                  <p className="text-sm text-slate-500 py-3 font-medium">
                    No academic years created yet. Create one via the Academic Calendar page to bind semester dates and holidays.
                  </p>
                ) : (
                  <div className="space-y-3 pt-2">
                    {academicYears.map((ay) => (
                      <div
                        key={ay.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 gap-3"
                      >
                        <div>
                          <div className="font-bold text-slate-950 dark:text-slate-100 text-sm mb-1">{ay.name}</div>
                          <div className="text-slate-500 dark:text-slate-400 text-xs font-medium">
                            {ay.start_date} to {ay.end_date} {ay.semester ? `• Semester ${ay.semester}` : ''}
                          </div>
                        </div>
                        {ay.is_active ? (
                          <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                            Active Context
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-slate-400 text-[11px] font-bold uppercase tracking-wider">Archived</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Col (1 col): Calendar Feed & Privacy */}
            <div className="space-y-8">
              
              {/* iCalendar Live Feed Card */}
              <div className="p-6 md:p-8 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <Calendar className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                  <h3 className="text-lg font-bold text-slate-950 dark:text-slate-100 tracking-tight">iCalendar Live Feed</h3>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                  Subscribe to your live academic schedule on Apple Calendar, Google Calendar, or Outlook. Changes sync automatically.
                </p>

                {feedUrl ? (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                        Subscription URL
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          readOnly
                          value={feedUrl}
                          className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-medium text-slate-700 dark:text-slate-300 focus:outline-none select-all"
                        />
                        <button
                          type="button"
                          onClick={copyToClipboard}
                          className="p-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl transition-colors shrink-0 border border-slate-200 dark:border-slate-700"
                          title="Copy subscription URL"
                        >
                          {copied ? <Check className="w-4 h-4 text-coral-500" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>
                      {feedCreatedAt && (
                        <p className="text-xs text-slate-500 font-medium">
                          Created on {new Date(feedCreatedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                      <button
                        type="button"
                        disabled={feedActionLoading}
                        onClick={handleGenerateFeed}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-200 text-xs rounded-xl font-bold transition-colors border border-slate-200 dark:border-slate-800"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Regenerate</span>
                      </button>

                      <button
                        type="button"
                        disabled={feedActionLoading}
                        onClick={handleRevokeFeed}
                        className="flex items-center justify-center gap-2 py-2.5 px-3 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs rounded-xl font-bold transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Revoke</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 space-y-4">
                    <button
                      type="button"
                      disabled={feedActionLoading}
                      onClick={handleGenerateFeed}
                      className="w-full py-3 px-4 bg-slate-950 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 text-white dark:text-slate-950 rounded-xl text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      {feedActionLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Key className="w-4 h-4" />
                      )}
                      <span>Generate Feed URL</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Privacy & Security Card */}
              <div className="p-6 md:p-8 rounded-2xl bg-slate-50/50 dark:bg-slate-900 border border-slate-300/50 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center gap-3 text-slate-950 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 pb-4">
                  <Shield className="w-5 h-5 text-coral-500" />
                  <h3 className="text-lg font-bold tracking-tight">Privacy & Security</h3>
                </div>
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                    Your academic data is kept private and linked only to your account.
                  </p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                    Your schedule is only updated through actions you actively confirm, ensuring you always remain in control of your data.
                  </p>
                </div>
              </div>

            </div>
          </div>
        )}
      </main>
    </div>
  );
}
