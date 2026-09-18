'use client';

import { useState } from 'react';
import { Download, Loader2, AlertCircle, DownloadCloud } from 'lucide-react';

interface ExportICSButtonProps {
  endpoint: '/api/schedule/export/timetable' | '/api/schedule/export/academic-calendar';
  filename: string;
  label: string;
  icon?: 'download' | 'download-cloud';
  className?: string;
  disabled?: boolean;
  disabledTooltip?: string;
}

export function ExportICSButton({
  endpoint,
  filename,
  label,
  icon = 'download',
  className = '',
  disabled = false,
  disabledTooltip = '',
}: ExportICSButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    if (disabled) return;
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(endpoint, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to export ICS:', err);
      setError('Failed to download calendar file.');
    } finally {
      setLoading(false);
    }
  };

  const IconComponent = icon === 'download' ? Download : DownloadCloud;

  return (
    <div className="relative inline-flex items-center">
      <button
        onClick={handleExport}
        disabled={loading || disabled}
        className={`${className} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        title={disabled ? disabledTooltip : label}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconComponent className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">{label}</span>
      </button>

      {error && (
        <div className="absolute top-full mt-2 w-max max-w-xs p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2 shadow-sm z-50">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-1 text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
