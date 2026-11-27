import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Database, Key, Server, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { isRealSupabaseConnected, updateSupabaseCredentials, clearSupabaseCredentials, SUPABASE_SQL_SCHEMA } from '../../services/supabase';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'config' | 'sql'>('config');
  const [url, setUrl] = useState(
    localStorage.getItem('cabfinder_supabase_url') || import.meta.env.VITE_SUPABASE_URL || ''
  );
  const [key, setKey] = useState(
    localStorage.getItem('cabfinder_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
  );
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isConnected = isRealSupabaseConnected();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !key) {
      onShowToast('Please provide both Project URL and Anon Key', 'error');
      return;
    }
    updateSupabaseCredentials(url, key);
  };

  const handleReset = () => {
    clearSupabaseCredentials();
  };

  const copySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    onShowToast('SQL Schema copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full my-auto max-h-[84dvh] sm:max-h-[90dvh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <Database className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-900 truncate">
                Supabase Database & Architecture
              </h3>
              <p className="text-xs text-slate-500 truncate">
                Configure connection or export SQL schemas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 px-4 sm:px-6 pt-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`min-h-[42px] pb-2 pt-1 px-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'config'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Connection Status
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            className={`min-h-[42px] pb-2 pt-1 px-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'sql'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            SQL Migration Script
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-5 text-sm flex-1 min-h-0">
          {activeTab === 'config' ? (
            <div>
              {/* Status Banner */}
              <div
                className={`p-3.5 sm:p-4 rounded-xl border mb-5 flex items-start gap-3 ${
                  isConnected
                    ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}
              >
                <div
                  className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                    isConnected ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                <div className="min-w-0">
                  <div className="font-semibold text-sm">
                    {isConnected ? 'Connected to Live Supabase Database' : 'Supabase Database Not Connected'}
                  </div>
                  <p className="text-xs mt-1 text-slate-600 leading-relaxed">
                    {isConnected
                      ? 'Your application is querying and writing directly to your remote Supabase PostgreSQL tables with RLS policies.'
                      : 'All data requires a live Supabase database connection. Enter your Supabase Project URL and Anon Key below to connect.'}
                  </p>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Supabase Project URL
                  </label>
                  <div className="relative">
                    <Server className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type="url"
                      placeholder="https://your-project.supabase.co"
                      value={url}
                      onChange={e => setUrl(e.target.value)}
                      className="w-full min-h-[46px] pl-10 pr-3 py-2 text-base sm:text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      Supabase Anon Public API Key
                    </label>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Client-Safe (RLS Guarded)
                    </span>
                  </div>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI..."
                      value={key}
                      onChange={e => setKey(e.target.value)}
                      className="w-full min-h-[46px] pl-10 pr-12 py-2 text-base sm:text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                      title={showKey ? 'Hide key' : 'Show key'}
                      aria-label={showKey ? 'Hide key' : 'Show key'}
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                    The <code className="text-emerald-700 font-semibold bg-emerald-50 px-1 rounded">anon</code> key is safe for client browsers. PostgreSQL Row Level Security (RLS) protects tables. Never enter your secret <code className="text-rose-600 font-semibold bg-rose-50 px-1 rounded">service_role</code> key here.
                  </p>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 pt-2">
                  {localStorage.getItem('cabfinder_supabase_url') && (
                    <button
                      type="button"
                      onClick={handleReset}
                      className="min-h-[44px] text-xs text-rose-600 hover:text-rose-700 font-medium text-center sm:text-left px-2"
                    >
                      Clear Saved Credentials
                    </button>
                  )}
                  <div className="flex items-center gap-2 sm:ml-auto">
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-[46px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 border border-slate-200 rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 sm:flex-initial min-h-[46px] px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs"
                    >
                      Save & Reload
                    </button>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <span className="text-xs text-slate-600 leading-relaxed">
                  Run this SQL in your <strong>Supabase SQL Editor</strong>. It creates all tables, adds the <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-semibold">route_area</code> column, and configures RLS &amp; security triggers:
                </span>
                <button
                  type="button"
                  onClick={copySQL}
                  className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors shrink-0"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Copied' : 'Copy SQL'}</span>
                </button>
              </div>

              <pre className="p-3.5 sm:p-4 bg-slate-900 text-slate-100 rounded-xl text-[11px] sm:text-xs font-mono overflow-x-auto max-h-72">
                <code>{SUPABASE_SQL_SCHEMA}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
