import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Send } from 'lucide-react';
import { FinalCab, CabRequestType } from '../../types';
import { submitCabRequests } from '../../services/supabase';

interface ReportWrongModalProps {
  cab: FinalCab | null;
  userId: string;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const ReportWrongModal: React.FC<ReportWrongModalProps> = ({
  cab,
  userId,
  userEmail,
  onClose,
  onSuccess,
  onShowToast
}) => {
  const [requestType, setRequestType] = useState<CabRequestType>('UPDATE');
  const [driverNumber, setDriverNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [location, setLocation] = useState<'SAR 2' | 'SAR 3'>(
    cab?.route_area && cab.route_area.toLowerCase().includes('3') ? 'SAR 3' : 'SAR 2'
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cab) {
      setRequestType('UPDATE');
      setDriverNumber('');
      setNotes('');
      setLocation(cab.route_area && cab.route_area.toLowerCase().includes('3') ? 'SAR 3' : 'SAR 2');
    }
  }, [cab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (cab) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cab, onClose]);

  if (!cab) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (requestType === 'UPDATE') {
      const cleanPhone = driverNumber.replace(/\D/g, '');
      if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
        onShowToast('Please provide a valid 10-digit driver mobile number (starting with 6-9).', 'error');
        return;
      }
    } else if (requestType === 'REMOVE' && !notes.trim()) {
      onShowToast('Please enter a short reason for decommissioning this cab.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await submitCabRequests(
        [
          {
            cab_number: cab.cab_number,
            driver_name: null,
            driver_number: requestType === 'REMOVE' ? cab.driver_number : driverNumber,
            old_driver_number: cab.driver_number,
            request_type: requestType,
            route_area: location,
            notes: requestType === 'REMOVE' ? notes.trim() : null
          }
        ],
        userId,
        userEmail
      );

      if (error) {
        onShowToast(error, 'error');
      } else {
        onShowToast(
          `Request for Cab #${cab.cab_number} submitted for Admin review`,
          'success'
        );
        onSuccess();
        onClose();
      }
    } catch {
      onShowToast('Failed to submit request', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm sm:max-w-md w-full my-auto overflow-hidden flex flex-col max-h-[82dvh]">
        {/* Compact Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 truncate">
                Report or Update #{cab.cab_number}
              </h3>
              <p className="text-[11px] text-slate-500 truncate font-sans tabular-nums">
                +91 {cab.driver_number} · {cab.route_area && cab.route_area.toLowerCase().includes('3') ? 'SAR 3' : 'SAR 2'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-xl shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 p-4 overflow-y-auto overscroll-contain space-y-3">
          {/* Action Type Selector */}
          <div className="flex p-1 bg-slate-100 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => setRequestType('UPDATE')}
              className={`flex-1 min-h-[40px] py-1.5 px-2 rounded-lg transition-colors ${
                requestType === 'UPDATE' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Update Number
            </button>
            <button
              type="button"
              onClick={() => setRequestType('REMOVE')}
              className={`flex-1 min-h-[40px] py-1.5 px-2 rounded-lg transition-colors ${
                requestType === 'REMOVE' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-500'
              }`}
            >
              Decommissioned
            </button>
          </div>

          <form id="report-wrong-form" onSubmit={handleSubmit} className="space-y-3 text-xs">
            {requestType === 'UPDATE' ? (
              <>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    New Driver Mobile (10 digits) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 text-slate-600 text-xs font-sans">
                      +91
                    </span>
                    <input
                      type="tel"
                      inputMode="tel"
                      required
                      maxLength={10}
                      placeholder="9876543210"
                      value={driverNumber}
                      onChange={e => setDriverNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full min-h-[44px] px-3 py-2 text-base sm:text-sm rounded-r-xl border border-slate-200 font-sans tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Location
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['SAR 3', 'SAR 2'] as const).map(loc => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocation(loc)}
                        className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${
                          location === loc
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-2.5">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 leading-snug text-xs">
                  Requesting removal of Cab #{cab.cab_number}. Admin will review before updating the directory.
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="decommission-reason" className="block font-semibold text-slate-700">
                      Reason for Decommissioning <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {notes.length}/200
                    </span>
                  </div>
                  <textarea
                    id="decommission-reason"
                    rows={2}
                    required
                    maxLength={200}
                    placeholder="e.g., Cab sold, wrong plate, or driver left route"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    className="w-full px-3 py-2 text-base sm:text-xs rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Sticky Footer */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/90 flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="report-wrong-form"
            disabled={submitting}
            className="flex-1 min-h-[44px] px-4 py-2 flex items-center justify-center gap-1.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 rounded-xl shadow-xs transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Submitting...' : 'Submit to Admin'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
