import React from 'react';
import { ShieldCheck, Database, LogOut, ArrowRightLeft, Search, PlusCircle } from 'lucide-react';
import { UserProfile } from '../../types';
import { CabFinderLogo } from './CabFinderLogo';

interface NavbarProps {
  user: UserProfile | null;
  currentView: 'search' | 'admin';
  onChangeView: (view: 'search' | 'admin') => void;
  onRequestCab: () => void;
  onOpenDbConfig: () => void;
  onSignOut: () => void;
  onQuickToggleRole: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  currentView,
  onChangeView,
  onRequestCab,
  onOpenDbConfig,
  onSignOut,
  onQuickToggleRole
}) => {
  const isAdmin = user?.role === 'admin';
  const displayIdentifier = user?.employee_id || user?.personal_email.split('@')[0] || 'User';

  return (
    <header className="shrink-0 md:sticky md:top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 h-13 sm:h-16 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 min-w-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <CabFinderLogo className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
          </div>
          <button
            onClick={() => onChangeView('search')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap hover:text-emerald-700 transition-colors min-h-[44px] flex items-center"
          >
            CabFinder
          </button>
        </div>

        {/* Zone 2: Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => onChangeView('search')}
            className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 py-1 border-b-2 ${
              currentView === 'search'
                ? 'border-emerald-600 text-emerald-700 font-semibold'
                : 'border-transparent'
            }`}
          >
            Directory Search
          </button>

          <button
            onClick={onRequestCab}
            className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 py-1 border-b-2 border-transparent"
          >
            + Request Cab
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => onChangeView('admin')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 py-1 border-b-2 flex items-center gap-1.5 ${
                  currentView === 'admin'
                    ? 'border-emerald-600 text-emerald-700 font-semibold'
                    : 'border-transparent'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Admin Approvals</span>
              </button>

              <button
                onClick={onOpenDbConfig}
                className="whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 py-1 border-b-2 border-transparent flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700"
              >
                <Database className="w-3.5 h-3.5 text-slate-400" />
                <span>Supabase Schema</span>
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: WhatsApp Support & User Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <a
            href="https://wa.me/?text=Hi%20CabFinder%20Team,%20I%20need%20assistance%20with%20cab%20directory"
            target="_blank"
            rel="noopener noreferrer"
            title="Chat on WhatsApp"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-all shadow-2xs min-h-[40px] whitespace-nowrap active:scale-[0.97]"
          >
            <svg className="w-4 h-4 text-[#25D366] fill-current shrink-0" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span className="hidden sm:inline">WhatsApp Help</span>
            <span className="sm:hidden text-[11px]">Help</span>
          </a>

          {isAdmin && (
            <button
              onClick={onQuickToggleRole}
              title={currentView === 'admin' ? 'Switch to Employee Directory view' : 'Switch to Admin Approvals view'}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg transition-colors min-h-[40px] whitespace-nowrap"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentView === 'admin' ? 'Employee View' : 'Admin Approvals'}</span>
            </button>
          )}

          {/* User profile & Sign out */}
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200">
            <div className="text-right">
              <div className="text-[11px] sm:text-xs font-semibold text-slate-900 truncate max-w-[78px] sm:max-w-[130px] font-mono tabular-nums">
                {displayIdentifier}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center justify-end gap-1">
                {isAdmin ? (
                  <span className="text-emerald-700 font-semibold">Admin</span>
                ) : (
                  <span>Employee</span>
                )}
              </div>
            </div>

            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 active:bg-slate-200 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Sign out"
            >
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

interface MobileBottomNavProps {
  user: UserProfile | null;
  currentView: 'search' | 'admin';
  onSelectSearch: () => void;
  onRequestCab: () => void;
  onSelectAdmin: () => void;
  onOpenDbConfig: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  user,
  currentView,
  onSelectSearch,
  onRequestCab,
  onSelectAdmin,
  onOpenDbConfig
}) => {
  const isAdmin = user?.role === 'admin';

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden shrink-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_20px_rgba(15,23,42,0.08)] pb-safe"
    >
      <div className={`grid ${isAdmin ? 'grid-cols-4' : 'grid-cols-2'} items-center h-14`}>
        <button
          type="button"
          onClick={onSelectSearch}
          className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-slate-100 ${
            currentView === 'search' ? 'text-emerald-700 bg-emerald-50/40' : 'text-slate-500'
          }`}
        >
          {currentView === 'search' && (
            <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-emerald-600 rounded-full" />
          )}
          <Search className={`w-5 h-5 ${currentView === 'search' ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
          <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
            Search
          </span>
        </button>

        <button
          type="button"
          onClick={onRequestCab}
          className="h-full flex flex-col items-center justify-center gap-0.5 text-emerald-700 active:bg-emerald-50 transition-colors"
        >
          <PlusCircle className="w-5 h-5 stroke-[2.3]" />
          <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
            Add Cab
          </span>
        </button>

        {isAdmin && (
          <>
            <button
              type="button"
              onClick={onSelectAdmin}
              className={`relative h-full flex flex-col items-center justify-center gap-0.5 transition-colors active:bg-slate-100 ${
                currentView === 'admin' ? 'text-emerald-700 bg-emerald-50/40' : 'text-slate-500'
              }`}
            >
              {currentView === 'admin' && (
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 bg-emerald-600 rounded-full" />
              )}
              <ShieldCheck className={`w-5 h-5 ${currentView === 'admin' ? 'stroke-[2.5]' : 'stroke-[2]'}`} />
              <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                Admin
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenDbConfig}
              className="h-full flex flex-col items-center justify-center gap-0.5 text-slate-500 active:bg-slate-100 transition-colors"
            >
              <Database className="w-5 h-5 stroke-[2]" />
              <span className="text-[11px] font-semibold tracking-tight whitespace-nowrap">
                Schema
              </span>
            </button>
          </>
        )}
      </div>
    </nav>
  );
};
