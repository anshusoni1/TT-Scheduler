'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  Bot,
  ArrowLeft,
  Send,
  Loader2,
  Sparkles,
  Calendar,
  Clock,
  BarChart3,
  BookOpen,
  CalendarX,
  AlertCircle,
  Wrench,
} from 'lucide-react';
import type { AssistantMessage, AssistantToolCallInfo } from '@/server/services/ai/academic-assistant.service';
import type { ApiResponse } from '@/types/api';

interface ChatEntry extends AssistantMessage {
  toolsUsed?: AssistantToolCallInfo[];
}

const SUGGESTED_QUERIES = [
  { label: 'Classes today', query: 'What classes do I have today?', icon: Calendar },
  { label: 'Next class', query: 'When is my next class and in which room?', icon: Clock },
  { label: 'Attendance status', query: 'What is my current attendance summary and safe cuts margin?', icon: BarChart3 },
  { label: 'Next holiday', query: 'When is my next holiday on the academic calendar?', icon: CalendarX },
  { label: 'Teaching days', query: 'How many teaching days are remaining in this semester?', icon: BookOpen },
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your ClassFlow Academic Assistant. I can check your today schedule, upcoming classes, academic holidays, teaching days, and real-time attendance figures. What would you like to know?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (messageText?: string) => {
    const query = (messageText || input).trim();
    if (!query || loading) return;

    setInput('');
    setErrorBanner(null);

    const newHistory: ChatEntry[] = [...messages, { role: 'user', content: query }];
    setMessages(newHistory);
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const json: ApiResponse<{ answer: string; toolsUsed: AssistantToolCallInfo[] }> = await res.json();

      if (!res.ok || !json.success) {
        const msg = !json.success && 'error' in json ? json.error.message : 'Failed to get response from assistant';
        throw new Error(msg);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: json.data.answer,
          toolsUsed: json.data.toolsUsed,
        },
      ]);
    } catch (err) {
      setErrorBanner((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-neutral-400 hover:text-neutral-200 transition-colors p-1 rounded-lg hover:bg-neutral-800"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-bold text-neutral-100 flex items-center gap-2">
                  <span>ClassFlow AI Assistant</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Gemini 3.6 Flash
                  </span>
                </h1>
                <p className="text-[11px] text-neutral-400">Deterministic Tool Calling • Real Schedule Grounding</p>
              </div>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="text-xs text-neutral-400 hover:text-neutral-200 px-3 py-1.5 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Chat Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 flex flex-col justify-between">
        {/* Messages list */}
        <div className="space-y-4 mb-6">
          {errorBanner && (
            <div className="p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-300 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-red-200">
                Dismiss
              </button>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-neutral-900 border border-neutral-800 text-neutral-200'
                }`}
              >
                {/* Tools used pill badge */}
                {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                  <div className="mb-2.5 pb-2 border-b border-neutral-800/80 flex flex-wrap gap-1.5">
                    {msg.toolsUsed.map((tool, tIdx) => (
                      <span
                        key={tIdx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-neutral-950 text-neutral-400 border border-neutral-800 text-[10px] font-mono"
                        title={tool.resultSummary}
                      >
                        <Wrench className="w-2.5 h-2.5 text-purple-400" />
                        <span>{tool.toolName}</span>
                      </span>
                    ))}
                  </div>
                )}

                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl px-4 py-3 text-sm text-neutral-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                <span>Consulting deterministic schedule & attendance engines...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggested Queries & Input Bar */}
        <div className="sticky bottom-4 bg-neutral-950/80 backdrop-blur pt-2">
          {/* Suggestion Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-3 scrollbar-none">
            {SUGGESTED_QUERIES.map((sq, idx) => {
              const Icon = sq.icon;
              return (
                <button
                  key={idx}
                  onClick={() => handleSend(sq.query)}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 rounded-full text-xs text-neutral-300 hover:text-white shrink-0 transition-colors disabled:opacity-50"
                >
                  <Icon className="w-3 h-3 text-purple-400" />
                  <span>{sq.label}</span>
                </button>
              );
            })}
          </div>

          {/* Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-1.5 focus-within:border-purple-500 transition-colors"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your classes, next lecture, holiday, or attendance..."
              disabled={loading}
              className="flex-1 bg-transparent px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl transition-colors shrink-0 shadow-md shadow-purple-600/20"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
