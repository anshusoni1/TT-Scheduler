'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Upload,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Trash2,
  ArrowRight,
  Loader2,
  Calendar,
  Layers,
  HelpCircle,
  FileCheck,
  ShieldCheck,
} from 'lucide-react';
import type { DocumentWithJob } from '@/server/repositories/documents.repository';
import type { DocumentType } from '@/lib/constants/extraction';

const processingMessages = [
  "Uploading document…",
  "Reading document layout…",
  "Finding subjects and class times…",
  "Matching schedule details…",
  "Preparing your schedule…"
];

export default function DocumentsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [documents, setDocuments] = useState<DocumentWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [processingMessageIndex, setProcessingMessageIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (uploading) {
      setProcessingMessageIndex(0);
      interval = setInterval(() => {
        setProcessingMessageIndex((prev) => Math.min(prev + 1, processingMessages.length - 1));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [uploading]);

  const [dragActive, setDragActive] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState<DocumentType>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents');
      if (!res.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await res.json();
      setDocuments(data.data.documents || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    setError(null);
    setSuccess(null);

    // Client-side file validation
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowed.includes(file.type)) {
      setError('Invalid file type. Please upload a JPG, PNG, WEBP, or PDF document.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError(`File size is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum allowed size is 10MB.`);
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', selectedDocType);

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to upload document');
      }
      
      const updatedDoc = (data.data as { document: DocumentWithJob }).document;
      setSuccess(`Your schedule is ready.`);
      
      // Auto-navigate to review page
      if (updatedDoc) {
        router.push(`/documents/${updatedDoc.id}/review`);
      }
      fetchDocuments();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed';
      if (errorMsg.includes('429') || errorMsg.toLowerCase().includes('rate limit') || errorMsg.includes('AI') || errorMsg.includes('Gemini') || errorMsg.includes('fetch')) {
        setError("We're taking a little longer than usual. Please try again in a moment.");
      } else {
        setError(errorMsg);
      }
    } finally {
      setUploading(false);
      setUploadFileName(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReprocess = async (documentId: string) => {
    try {
      setReprocessingId(documentId);
      setError(null);
      const res = await fetch(`/api/documents/${documentId}/reprocess`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to reprocess document');
      }
      setSuccess('Document re-analysis completed!');
      fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Reprocessing failed');
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDelete = async (documentId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"? This will also remove the uploaded file from storage.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        throw new Error('Failed to delete document');
      }
      setSuccess(`Document "${fileName}" deleted.`);
      fetchDocuments();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const getDocTypeBadge = (type: DocumentType) => {
    switch (type) {
      case 'timetable':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
            <Clock className="h-3 w-3" /> Timetable
          </span>
        );
      case 'calendar':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300">
            <Calendar className="h-3 w-3" /> Academic Calendar
          </span>
        );
      case 'mixed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-300">
            <Layers className="h-3 w-3" /> Combined
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            <HelpCircle className="h-3 w-3" /> Auto-Detect
          </span>
        );
    }
  };

  const getStatusBadge = (status: string, warningsCount = 0) => {
    switch (status) {
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3" /> Committed to Schedule
          </span>
        );
      case 'needs_review':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 animate-pulse">
            <AlertCircle className="h-3 w-3" /> Review Required {warningsCount > 0 ? `(${warningsCount} warnings)` : ''}
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing...
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300">
            <AlertCircle className="h-3 w-3" /> Extraction Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            <Clock className="h-3 w-3" /> Uploaded
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Notifications */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
            <button onClick={() => setError(null)} className="text-xs font-bold text-rose-500 hover:text-rose-700">
              ✕
            </button>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            <div className="flex-1 font-medium">{success}</div>
            <button onClick={() => setSuccess(null)} className="text-xs font-bold text-emerald-500 hover:text-emerald-700">
              ✕
            </button>
          </div>
        )}

        {/* Security & Verification Guarantee Banner */}
        <div className="mb-8 p-4 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 via-purple-50/50 to-white dark:from-indigo-950/30 dark:via-purple-950/20 dark:to-slate-900 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-400/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Review before saving
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Your schedule won&apos;t change until you review and confirm the extracted details.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Zone Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-6 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Timetable or Academic Calendar
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Supports PDF, JPG, PNG, and WEBP documents up to 10MB
              </p>
            </div>

            {/* Document Type Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
                Type Hint:
              </label>
              <select
                value={selectedDocType}
                onChange={(e) => setSelectedDocType(e.target.value as DocumentType)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="unknown">Auto-Detect</option>
                <option value="timetable">Timetable (Weekly Classes)</option>
                <option value="calendar">Academic Calendar (Holidays/Terms)</option>
                <option value="mixed">Combined / Mixed</option>
              </select>
            </div>
          </div>

          {/* Drag and Drop Zone */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 hover:bg-slate-50 dark:hover:bg-slate-800/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {uploading ? (
              <div className="flex flex-col items-center justify-center py-4">
                <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mb-3" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white transition-all duration-300">
                  {processingMessages[processingMessageIndex]}
                </h3>
                {uploadFileName && (
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full">
                    {uploadFileName}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="h-12 w-12 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                  <Upload className="h-6 w-6" />
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Click to select or drag and drop document here
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upload an official college timetable image, multi-page calendar PDF, or syllabus schedule
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">PDF</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">PNG</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">JPG</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">WEBP</span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">Up to 10 MB</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Documents List */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Uploaded Documents ({documents.length})
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                All uploaded documents with extraction status and review actions
              </p>
            </div>
            <button
              onClick={fetchDocuments}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 mb-2" />
              <p className="text-xs">Loading documents...</p>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <FileText className="h-10 w-10 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">No documents uploaded yet</h3>
              <p className="text-xs mt-1 max-w-sm mx-auto">
                Upload your college timetable or academic calendar above to start the automated processing and review workflow.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {documents.map((doc) => {
                const warnings = (doc.latest_job?.validation_result as Record<string, unknown>)?.warnings as string[] || [];
                return (
                  <div
                    key={doc.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 flex-shrink-0 mt-0.5">
                        <FileCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                            {doc.file_name}
                          </h3>
                          {getDocTypeBadge(doc.document_type)}
                          {getStatusBadge(doc.processing_status, warnings.length)}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span>{(doc.file_size / 1024).toFixed(0)} KB</span>
                          <span>Uploaded: {new Date(doc.created_at).toLocaleDateString()}</span>
                          <span>Version {doc.processing_version}</span>
                          {doc.latest_job?.attempt_count ? (
                            <span>Attempts: {doc.latest_job.attempt_count}</span>
                          ) : null}
                        </div>

                        {/* Error notice if failed */}
                        {doc.processing_status === 'failed' && doc.latest_job?.error_message && (
                          <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mt-1.5 flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5" />
                            {doc.latest_job.error_message}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      {doc.processing_status === 'needs_review' && (
                        <Link
                          href={`/documents/${doc.id}/review`}
                          className="text-xs font-bold px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-sm flex items-center gap-1.5 transition-colors"
                        >
                          <span>Review & Confirm</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      )}

                      {doc.processing_status === 'completed' && (
                        <Link
                          href={`/documents/${doc.id}/review`}
                          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          View Details
                        </Link>
                      )}

                      <button
                        onClick={() => handleReprocess(doc.id)}
                        disabled={reprocessingId === doc.id || doc.processing_status === 'processing'}
                        title="Re-analyze document"
                        className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 flex items-center gap-1 transition-colors"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${reprocessingId === doc.id ? 'animate-spin' : ''}`} />
                        <span>Re-analyze</span>
                      </button>

                      <button
                        onClick={() => handleDelete(doc.id, doc.file_name)}
                        title="Delete document"
                        className="text-xs font-semibold p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-rose-600 hover:border-rose-300 dark:hover:border-rose-800 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
