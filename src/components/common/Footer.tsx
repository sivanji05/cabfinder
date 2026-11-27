import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto py-2.5 sm:py-4 px-3 border-t border-slate-200/80 bg-white/80 text-center text-xs text-slate-500">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5">
        <span>
          Application developed by a{' '}
          <span className="font-semibold text-slate-900 tracking-wide">
            fellow colleague
          </span>
        </span>
        <span className="hidden sm:inline text-slate-300">·</span>
        <span className="hidden sm:inline text-[11px] text-slate-400">
        </span>
      </div>
    </footer>
  );
};
