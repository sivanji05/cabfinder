import React, { useState } from 'react';
import { Phone, Copy, Check, AlertTriangle, Car, MapPin } from 'lucide-react';
import { FinalCab } from '../../types';

interface CabResultCardProps {
  cab: FinalCab;
  onReportWrongNumber: (cab: FinalCab) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const CabResultCard: React.FC<CabResultCardProps> = ({
  cab,
  onReportWrongNumber,
  onShowToast
}) => {
  const [copied, setCopied] = useState(false);

  const formattedPhone = cab.driver_number.startsWith('+91')
    ? cab.driver_number
    : `+91 ${cab.driver_number.slice(0, 5)} ${cab.driver_number.slice(5)}`;

  const cleanDigits = cab.driver_number.replace(/\D/g, '');

  const handleCopy = () => {
    navigator.clipboard.writeText(cleanDigits);
    setCopied(true);
    onShowToast(`Copied driver contact for Cab #${cab.cab_number}`, 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  // Normalize location strictly to SAR 2 or SAR 3
  const locationLabel = cab.route_area && cab.route_area.toLowerCase().includes('3')
    ? 'SAR 3'
    : 'SAR 2';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-md transition-all p-4 sm:p-5 flex flex-col justify-between">
      {/* Top Section */}
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span className="uppercase tracking-wider">Cab Number</span>
              <span aria-hidden="true" className="text-slate-300">·</span>
              <span className="text-emerald-700">Active Fleet</span>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5 flex items-center gap-2 font-sans tabular-nums">
              <Car className="w-6 h-6 text-emerald-600 shrink-0" />
              <span>{cab.cab_number}</span>
            </div>
          </div>

          <button
            onClick={() => onReportWrongNumber(cab)}
            className="min-h-[44px] px-2.5 text-xs font-medium text-slate-500 hover:text-amber-700 hover:bg-amber-50 active:bg-amber-100 rounded-xl transition-colors flex items-center gap-1.5 shrink-0"
            title="Report wrong number or update request"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="text-xs">Report</span>
          </button>
        </div>

        {/* Contact & Location Details */}
        <div className="py-3 border-y border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] text-slate-400 uppercase tracking-wide block">
              Driver Contact Number
            </span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-base sm:text-lg font-bold font-sans tabular-nums text-slate-900">
                {formattedPhone}
              </span>
              <button
                onClick={handleCopy}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 active:bg-slate-100 rounded-xl transition-colors"
                title="Copy phone number"
                aria-label="Copy phone number"
              >
                {copied ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Strict Location: SAR 2 or SAR 3 */}
          <div className="flex flex-col items-end">
            <span className="text-[11px] text-slate-400 uppercase tracking-wide">Location</span>
            <span className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
              <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>{locationLabel}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Action Button — Full-Width Thumb Target */}
      <div className="mt-4">
        <a
          href={`tel:${cleanDigits}`}
          className="w-full h-12 min-h-[48px] flex items-center justify-center gap-2 text-base font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <Phone className="w-4.5 h-4.5 fill-white" />
          <span>Call Driver</span>
        </a>
      </div>
    </div>
  );
};
