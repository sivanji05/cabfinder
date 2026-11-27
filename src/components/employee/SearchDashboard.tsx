import React, { useState, useEffect, useRef } from 'react';
import { Search, Car, Plus, History, Sparkles, X } from 'lucide-react';
import { FinalCab } from '../../types';
import { searchFinalCabs } from '../../services/supabase';
import { CabResultCard } from './CabResultCard';

interface SearchDashboardProps {
  onOpenRequestModal: () => void;
  onReportWrongNumber: (cab: FinalCab) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const SearchDashboard: React.FC<SearchDashboardProps> = ({
  onOpenRequestModal,
  onReportWrongNumber,
  onShowToast
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<FinalCab[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const saveRecentSearch = (term: string) => {
    if (!term || term.length < 4) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item !== term);
      return [term, ...filtered].slice(0, 5);
    });
  };

  const executeSearch = async (term: string) => {
    const clean = term.replace(/\D/g, '').slice(0, 4);
    if (!clean) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const found = await searchFinalCabs(clean);
      setResults(found);
      if (clean.length === 4 && found.length > 0) {
        saveRecentSearch(clean);
      }
    } catch (err: any) {
      setResults([]);
      onShowToast(err?.message || 'Error searching cabs from database', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 300ms debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setSearchTerm(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    debounceTimerRef.current = setTimeout(() => {
      executeSearch(val);
    }, 300);
  };

  // Quick chip click
  const handleChipClick = (cabNo: string) => {
    setSearchTerm(cabNo);
    executeSearch(cabNo);
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-3.5 sm:px-6 py-4 sm:py-10 space-y-5 sm:space-y-8">
      {/* Hero Search Box */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-8 space-y-4 sm:space-y-6">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] sm:text-xs font-semibold mb-2 sm:mb-3">
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>Fast 4-Digit Fleet Directory</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Find Cab Driver in Seconds
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 sm:mt-1.5 leading-relaxed">
            Enter the last 4 digits of the cab number (e.g. 5553) to call the assigned driver in one tap.
          </p>
        </div>

        {/* Input Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 sm:pl-5 flex items-center pointer-events-none">
            <Search className={`w-5 h-5 ${loading ? 'text-emerald-600 animate-pulse' : 'text-slate-400'}`} />
          </div>

          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={4}
            value={searchTerm}
            onChange={handleInputChange}
            placeholder="4-digit cab no (e.g. 5553)"
            className="w-full min-h-[54px] pl-11 sm:pl-14 pr-14 py-3.5 sm:py-5 text-lg sm:text-xl font-bold font-sans tabular-nums tracking-wider rounded-2xl border-2 border-slate-200 bg-slate-50/50 hover:bg-white focus:bg-white focus:border-emerald-600 focus:outline-none transition-all placeholder:font-sans placeholder:text-sm sm:placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
          />

          {searchTerm && (
            <div className="absolute inset-y-0 right-1.5 flex items-center">
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setResults([]);
                  setHasSearched(false);
                }}
                aria-label="Clear cab search"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-colors"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Search Chips — Session-only recent found cabs */}
        {recentSearches.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5 -mx-1 px-1">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-400 flex items-center gap-1 shrink-0 mr-0.5">
              <History className="w-3.5 h-3.5" />
              <span>Recent:</span>
            </span>

            {recentSearches.map(cabNo => (
              <button
                key={cabNo}
                type="button"
                onClick={() => handleChipClick(cabNo)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-sans tabular-nums font-semibold shrink-0 transition-all active:scale-[0.97] ${
                  searchTerm === cabNo
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                #{cabNo}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results Header */}
      {hasSearched && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="text-[11px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
            {loading ? (
              <span>Searching fleet database...</span>
            ) : results.length > 0 ? (
              <span>
                Found {results.length} active driver{results.length > 1 ? 's' : ''} for #{searchTerm}
              </span>
            ) : (
              <span>No Matching Fleet Records</span>
            )}
          </div>

          {results.length > 1 && (
            <span className="text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
              Multiple Drivers Registered
            </span>
          )}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {[1, 2].map(n => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 space-y-4 animate-pulse">
              <div className="h-6 bg-slate-200 rounded-md w-1/3" />
              <div className="h-4 bg-slate-100 rounded-md w-2/3" />
              <div className="h-12 bg-slate-100 rounded-xl w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Results Grid (Multiple Result Cards) */}
      {!loading && results.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
          {results.map(cab => (
            <CabResultCard
              key={cab.id}
              cab={cab}
              onReportWrongNumber={onReportWrongNumber}
              onShowToast={onShowToast}
            />
          ))}
        </div>
      )}

      {/* Clean Empty State */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-12 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Car className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-800">
              No Driver Found for Cab #{searchTerm}
            </h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Cab #{searchTerm} is not yet verified in the active production database. You can submit an addition request right now for Admin approval.
            </p>
          </div>
          <div>
            <button
              onClick={onOpenRequestModal}
              className="w-full sm:w-auto min-h-[48px] inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm sm:text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl shadow-xs transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Submit Request for Cab #{searchTerm}</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Mobile Info Summary + Desktop 3-Column Strip */}
      <div className="sm:hidden px-3.5 py-2.5 bg-white rounded-xl border border-slate-200 text-[11px] text-slate-500 text-center leading-relaxed">
        Tap <span className="font-semibold text-slate-700">Call Driver</span> for direct mobile dialer · Admin-verified fleet
      </div>

      <div className="hidden sm:grid sm:grid-cols-3 gap-4 text-xs text-slate-600 pt-2">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="font-bold text-slate-900 mb-1">Direct Call Integration</div>
          <p className="text-slate-500 leading-relaxed">
            Tapping &quot;Call Driver&quot; opens your mobile dialer with the driver&apos;s verified mobile number.
          </p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="font-bold text-slate-900 mb-1">Multiple Drivers Supported</div>
          <p className="text-slate-500 leading-relaxed">
            Cabs shared across shifts or routes appear as separate driver cards for easy identification.
          </p>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="font-bold text-slate-900 mb-1">Admin Verified</div>
          <p className="text-slate-500 leading-relaxed">
            New cab requests are verified and approved by the Transport Admin before appearing in searches.
          </p>
        </div>
      </div>
    </div>
  );
};
