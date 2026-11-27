import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Upload, FileText, Download, CheckCircle, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';
import { submitCabRequests } from '../../services/supabase';

interface CabRequestModalProps {
  isOpen: boolean;
  userId: string;
  userEmail: string;
  onClose: () => void;
  onSuccess: () => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface ManualRow {
  cab_number: string;
  driver_name?: string;
  driver_number: string;
  route_area?: string;
}

export const CabRequestModal: React.FC<CabRequestModalProps> = ({
  isOpen,
  userId,
  userEmail,
  onClose,
  onSuccess,
  onShowToast
}) => {
  const [activeTab, setActiveTab] = useState<'manual' | 'csv'>('manual');

  // Tab 1 state: Dynamic Manual Rows (1 to 10) - Default location is SAR 3
  const [rows, setRows] = useState<ManualRow[]>([
    { cab_number: '', driver_number: '', route_area: 'SAR 3' }
  ]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submittingManual, setSubmittingManual] = useState(false);

  // Tab 2 state: Bulk CSV
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvParsedRows, setCsvParsedRows] = useState<ManualRow[]>([]);
  const [csvParsingError, setCsvParsingError] = useState<string>('');
  const [csvValidationWarnings, setCsvValidationWarnings] = useState<string[]>([]);
  const [submittingCsv, setSubmittingCsv] = useState(false);

  // Helper to completely reset fields
  const resetForm = () => {
    setRows([{ cab_number: '', driver_number: '', route_area: 'SAR 3' }]);
    setFormErrors({});
    setCsvFile(null);
    setCsvParsedRows([]);
    setCsvParsingError('');
    setCsvValidationWarnings([]);
  };

  // Reset form whenever modal opens so old details are never lingering
  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  const handleModalClose = () => {
    resetForm();
    onClose();
  };

  // Close modal when user presses Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleModalClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  // Manual row updates
  const handleRowChange = (index: number, field: keyof ManualRow, value: string) => {
    const updated = [...rows];
    if (field === 'cab_number') {
      updated[index].cab_number = value.replace(/\D/g, '').slice(0, 4);
    } else if (field === 'driver_number') {
      updated[index].driver_number = value.replace(/\D/g, '').slice(0, 10);
    } else {
      updated[index][field] = value;
    }
    setRows(updated);

    if (formErrors[`${index}_${field}`]) {
      const newErrors = { ...formErrors };
      delete newErrors[`${index}_${field}`];
      setFormErrors(newErrors);
    }
  };

  const handleAddRow = () => {
    if (rows.length >= 10) {
      onShowToast('Maximum 10 rows allowed in manual submission. Use Bulk CSV for larger batches.', 'info');
      return;
    }
    setRows([
      ...rows,
      { cab_number: '', driver_number: '', route_area: 'SAR 3' }
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length === 1) {
      setRows([{ cab_number: '', driver_number: '', route_area: 'SAR 3' }]);
      return;
    }
    setRows(rows.filter((_, i) => i !== index));
  };

  // Validate manual rows
  const validateManualRows = (): boolean => {
    const errors: Record<string, string> = {};
    const seenCombinations = new Set<string>();

    rows.forEach((r, i) => {
      if (!r.cab_number || r.cab_number.length !== 4) {
        errors[`${i}_cab_number`] = 'Must be exactly 4 digits';
      }

      const phoneRegex = /^[6-9]\d{9}$/;
      if (!r.driver_number || !phoneRegex.test(r.driver_number)) {
        errors[`${i}_driver_number`] = 'Valid 10-digit phone (starts with 6-9)';
      }

      const combo = `${r.cab_number}_${r.driver_number}`;
      if (r.cab_number && r.driver_number) {
        if (seenCombinations.has(combo)) {
          errors[`${i}_cab_number`] = 'Duplicate cab & phone entry';
        } else {
          seenCombinations.add(combo);
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateManualRows()) {
      onShowToast('Please fix validation errors before submitting.', 'error');
      return;
    }

    setSubmittingManual(true);
    try {
      const { count, skippedCount, error } = await submitCabRequests(rows, userId, userEmail);
      if (error) {
        onShowToast(error, 'error');
      } else {
        const skipMsg = skippedCount ? ` (${skippedCount} already pending skipped)` : '';
        onShowToast(`Successfully submitted ${count} cab request(s)${skipMsg} for Admin approval!`, 'success');
        resetForm();
        onSuccess();
        onClose();
      }
    } catch {
      onShowToast('Submission failed', 'error');
    } finally {
      setSubmittingManual(false);
    }
  };

  // CSV handling
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setCsvParsingError('Please select a valid .csv file format.');
      return;
    }

    setCsvFile(file);
    setCsvParsingError('');
    setCsvValidationWarnings([]);

    Papa.parse<any>(file, {
      header: true,
      skipEmptyLines: true,
      complete: results => {
        if (results.errors.length) {
          setCsvParsingError(`CSV Parse warning: ${results.errors[0].message}`);
        }

        const validParsed: ManualRow[] = [];
        const seenCombinations = new Set<string>();
        const warnings: string[] = [];
        const phoneRegex = /^[6-9]\d{9}$/;
        const rowsData = results.data;

        for (let i = 0; i < rowsData.length; i++) {
          const row = rowsData[i];
          const rawCab = String(row.cab_number || row.cabNumber || row['Cab No'] || '').trim();
          const rawPhone = String(row.driver_number || row.driverNumber || row['Driver Phone'] || row.phone || '').trim();
          const cleanCab = rawCab.replace(/\D/g, '');
          const cleanPhone = rawPhone.replace(/\D/g, '');
          const rawLocation = String(row.location || row.route_area || row.route || '').trim().toLowerCase();
          const location = rawLocation.includes('2') ? 'SAR 2' : 'SAR 3';

          if (cleanCab.length !== 4) {
            warnings.push(`Row ${i + 1}: Cab number '${rawCab || 'empty'}' must be exactly 4 digits.`);
            continue;
          }

          if (!phoneRegex.test(cleanPhone)) {
            warnings.push(`Row ${i + 1}: Driver phone '${rawPhone || 'empty'}' must be a valid 10-digit number starting with 6, 7, 8, or 9.`);
            continue;
          }

          const combo = `${cleanCab}_${cleanPhone}`;
          if (seenCombinations.has(combo)) {
            warnings.push(`Row ${i + 1}: Duplicate Cab #${cleanCab} with phone ${cleanPhone} in file (skipped duplicate).`);
            continue;
          }
          seenCombinations.add(combo);

          validParsed.push({
            cab_number: cleanCab,
            driver_number: cleanPhone,
            route_area: location
          });
        }

        setCsvValidationWarnings(warnings);

        if (validParsed.length === 0) {
          setCsvParsingError('No valid rows recognized. All entries had validation errors or invalid formats.');
          setCsvParsedRows([]);
        } else {
          setCsvParsedRows(validParsed);
        }
      },
      error: err => {
        setCsvParsingError(`Error parsing CSV file: ${err.message}`);
      }
    });
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,cab_number,driver_number,location\n' +
      '3545,9876543210,SAR 3\n' +
      '8899,9123456789,SAR 3\n' +
      '1020,8845012345,SAR 2\n';

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'cabfinder_sample_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmitCsv = async () => {
    if (csvParsedRows.length === 0) {
      onShowToast('No parsed rows to submit.', 'error');
      return;
    }

    setSubmittingCsv(true);
    try {
      const { count, skippedCount, error } = await submitCabRequests(csvParsedRows, userId, userEmail);
      if (error) {
        onShowToast(error, 'error');
      } else {
        const skipMsg = skippedCount ? ` (${skippedCount} already pending skipped)` : '';
        onShowToast(
          `Successfully uploaded ${count} cab request(s)${skipMsg} for Admin approval!`,
          'success'
        );
        resetForm();
        onSuccess();
        onClose();
      }
    } catch {
      onShowToast('CSV submission failed', 'error');
    } finally {
      setSubmittingCsv(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) handleModalClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-3xl w-full my-auto overflow-hidden flex flex-col max-h-[84dvh] sm:max-h-[90dvh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Request New Cab Additions</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 truncate">
              Staged in <span className="font-mono text-slate-700">unapproved_cabs</span> for Admin review
            </p>
          </div>
          <button
            type="button"
            onClick={handleModalClose}
            aria-label="Close modal"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-xl transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 sm:flex items-center gap-2 px-4 sm:px-6 pt-2 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`min-h-[42px] pb-2 pt-1 px-2 sm:px-3 text-xs font-semibold border-b-2 flex items-center justify-center sm:justify-start gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'manual'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileText className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Manual (1-10)</span>
            <span className="hidden sm:inline">Tab 1: Dynamic Manual Rows (1 to 10 Cabs)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('csv')}
            className={`min-h-[42px] pb-2 pt-1 px-2 sm:px-3 text-xs font-semibold border-b-2 flex items-center justify-center sm:justify-start gap-1.5 transition-colors whitespace-nowrap ${
              activeTab === 'csv'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="w-4 h-4 shrink-0" />
            <span className="sm:hidden">Bulk CSV</span>
            <span className="hidden sm:inline">Tab 2: Bulk CSV Upload</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 space-y-4">
          {activeTab === 'manual' ? (
            <form id="cab-request-manual-form" onSubmit={handleSubmitManual} className="space-y-3.5">
              <div className="space-y-3">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 transition-all space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-500">
                        Row #{idx + 1}
                      </span>
                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(idx)}
                          className="min-h-[36px] px-2 text-rose-600 hover:text-rose-700 active:bg-rose-50 rounded-lg text-xs flex items-center gap-1 font-medium"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Cab Number */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Cab No (4 Digits) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          required
                          maxLength={4}
                          placeholder="e.g. 3545"
                          value={row.cab_number}
                          onChange={e => handleRowChange(idx, 'cab_number', e.target.value)}
                          className={`w-full min-h-[46px] px-3.5 py-2 text-base sm:text-sm font-sans tabular-nums rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 ${
                            formErrors[`${idx}_cab_number`]
                              ? 'border-rose-400 bg-rose-50/30'
                              : 'border-slate-200'
                          }`}
                        />
                        {formErrors[`${idx}_cab_number`] && (
                          <p className="text-[11px] text-rose-600 mt-1">
                            {formErrors[`${idx}_cab_number`]}
                          </p>
                        )}
                      </div>

                      {/* Driver Mobile */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Driver Mobile (10 Digits) <span className="text-rose-500">*</span>
                        </label>
                        <div className="flex">
                          <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-600 text-sm sm:text-xs font-sans">
                            +91
                          </span>
                          <input
                            type="tel"
                            inputMode="tel"
                            required
                            maxLength={10}
                            placeholder="9876543210"
                            value={row.driver_number}
                            onChange={e => handleRowChange(idx, 'driver_number', e.target.value)}
                            className={`w-full min-h-[46px] px-3.5 py-2 text-base sm:text-sm font-sans tabular-nums rounded-r-xl border bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 ${
                              formErrors[`${idx}_driver_number`]
                                ? 'border-rose-400 bg-rose-50/30'
                                : 'border-slate-200'
                            }`}
                          />
                        </div>
                        {formErrors[`${idx}_driver_number`] && (
                          <p className="text-[11px] text-rose-600 mt-1">
                            {formErrors[`${idx}_driver_number`]}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Location Selection: Large Segmented Buttons for Easy Thumb Tap */}
                    <div>
                      <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Location
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        {(['SAR 3', 'SAR 2'] as const).map(loc => {
                          const active = (row.route_area || 'SAR 3') === loc;
                          return (
                            <button
                              key={loc}
                              type="button"
                              onClick={() => handleRowChange(idx, 'route_area', loc)}
                              className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${
                                active
                                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {loc}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddRow}
                disabled={rows.length >= 10}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200/60 disabled:opacity-40 rounded-xl transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Add Another Cab Row ({rows.length}/10)</span>
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* CSV Instructions & Sample Download */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between p-4 bg-slate-50 border border-slate-200 rounded-2xl gap-3">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">CSV Formatting Instructions:</h4>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Columns: <span className="font-mono text-slate-700">cab_number</span> (4 digits), <span className="font-mono text-slate-700">driver_number</span> (10 digits), and <span className="font-mono text-slate-700">location</span> (SAR 2 or SAR 3).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="w-full sm:w-auto min-h-[44px] shrink-0 flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-xl shadow-2xs transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Sample CSV</span>
                </button>
              </div>

              {/* Dropzone */}
              <div className="p-6 sm:p-8 border-2 border-dashed border-slate-200 hover:border-emerald-500 rounded-2xl text-center bg-white transition-colors cursor-pointer relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-sm font-semibold text-slate-800 break-all px-2">
                    {csvFile ? csvFile.name : 'Tap to choose .csv file'}
                  </div>
                  <p className="text-xs text-slate-400">
                    Supports bulk uploads of 10 to 500+ records
                  </p>
                </div>
              </div>

              {csvParsingError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{csvParsingError}</span>
                </div>
              )}

              {csvValidationWarnings.length > 0 && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs space-y-1.5">
                  <div className="font-semibold flex items-center gap-1.5 text-amber-800">
                    <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>{csvValidationWarnings.length} invalid or duplicate row(s) filtered out:</span>
                  </div>
                  <ul className="list-disc list-inside max-h-28 overflow-y-auto pl-1 space-y-0.5 text-[11px] text-amber-800">
                    {csvValidationWarnings.map((msg, idx) => (
                      <li key={idx}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview of Parsed Rows */}
              {csvParsedRows.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <span className="flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle className="w-4 h-4 shrink-0" />
                      <span>{csvParsedRows.length} valid cab records recognized</span>
                    </span>
                  </div>

                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 text-xs">
                    {csvParsedRows.slice(0, 10).map((r, i) => (
                      <div key={i} className="px-3 py-2.5 flex items-center justify-between gap-2 bg-white">
                        <span className="font-sans font-bold text-slate-900">#{r.cab_number}</span>
                        <span className="font-sans text-slate-600 tabular-nums">+91 {r.driver_number}</span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                          {r.route_area || 'SAR 3'}
                        </span>
                      </div>
                    ))}
                    {csvParsedRows.length > 10 && (
                      <div className="px-3 py-2 text-center text-slate-400 bg-slate-50 text-[11px]">
                        + {csvParsedRows.length - 10} more records ready for batch upload
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky Bottom CTA Bar (Always reachable by thumb on mobile) */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/90 backdrop-blur-xs pb-[max(0.75rem,env(safe-area-inset-bottom))] shrink-0">
          {activeTab === 'manual' ? (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleModalClose}
                className="min-h-[48px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="cab-request-manual-form"
                disabled={submittingManual}
                className="flex-1 min-h-[48px] px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 rounded-xl shadow-xs transition-all"
              >
                {submittingManual
                  ? 'Submitting...'
                  : `Submit (${rows.length}) for Approval`}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  if (csvParsedRows.length > 0) {
                    setCsvFile(null);
                    setCsvParsedRows([]);
                    setCsvValidationWarnings([]);
                  } else {
                    handleModalClose();
                  }
                }}
                className="min-h-[48px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
              >
                {csvParsedRows.length > 0 ? 'Clear' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleSubmitCsv}
                disabled={submittingCsv || csvParsedRows.length === 0}
                className="flex-1 min-h-[48px] px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 rounded-xl shadow-xs transition-all"
              >
                {submittingCsv
                  ? 'Uploading Batch...'
                  : csvParsedRows.length > 0
                  ? `Upload & Submit ${csvParsedRows.length} Cabs`
                  : 'Select CSV File First'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
