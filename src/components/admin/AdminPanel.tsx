import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Check,
  X,
  Trash2,
  RefreshCw,
  Search,
  Plus,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Phone,
  Layers
} from 'lucide-react';
import { UnapprovedCab, FinalCab } from '../../types';
import {
  getPendingRequests,
  approveBatchRequests,
  rejectBatchRequests,
  getAllFinalCabs,
  deleteFinalCab,
  addDirectFinalCab
} from '../../services/supabase';

interface AdminPanelProps {
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ onShowToast }) => {
  const [activeTab, setActiveTab] = useState<'pending' | 'fleet'>('pending');

  // Pending Requests State
  const [pendingRequests, setPendingRequests] = useState<UnapprovedCab[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Array<number | string>>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);

  // Active Fleet State
  const [fleetCabs, setFleetCabs] = useState<FinalCab[]>([]);
  const [fleetTotal, setFleetTotal] = useState(0);
  const [fleetPage, setFleetPage] = useState(1);
  const [fleetSearch, setFleetSearch] = useState('');
  const [loadingFleet, setLoadingFleet] = useState(false);

  // Direct Add Modal in Fleet tab
  const [showDirectAdd, setShowDirectAdd] = useState(false);
  const [directCabNo, setDirectCabNo] = useState('');
  const [directDriverPhone, setDirectDriverPhone] = useState('');
  const [directRoute, setDirectRoute] = useState<'SAR 2' | 'SAR 3'>('SAR 3');

  const PAGE_SIZE = 10;

  // Load Pending Requests with pagination
  const loadPending = async (page: number = pendingPage) => {
    setLoadingPending(true);
    try {
      const res = await getPendingRequests(page, PAGE_SIZE);
      if (res.error) {
        onShowToast(res.error, 'error');
      }
      setPendingRequests(res.data);
      setPendingTotal(res.totalCount);
      setSelectedIds([]);
    } catch {
      onShowToast('Failed to load pending requests', 'error');
    } finally {
      setLoadingPending(false);
    }
  };

  // Load Active Fleet
  const loadFleet = async (page: number = fleetPage, search: string = fleetSearch) => {
    setLoadingFleet(true);
    try {
      const res = await getAllFinalCabs(page, PAGE_SIZE, search);
      if (res.error) {
        onShowToast(res.error, 'error');
      }
      setFleetCabs(res.data);
      setFleetTotal(res.totalCount);
    } catch {
      onShowToast('Failed to load active fleet', 'error');
    } finally {
      setLoadingFleet(false);
    }
  };

  // Fetch both pending and active fleet counts on initial mount so tab badges are always accurate
  useEffect(() => {
    loadPending(1);
    loadFleet(1, '');
  }, []);

  useEffect(() => {
    if (activeTab === 'pending') {
      loadPending(pendingPage);
    }
  }, [pendingPage]);

  useEffect(() => {
    if (activeTab === 'fleet') {
      loadFleet(fleetPage, fleetSearch);
    }
  }, [fleetPage]);

  // Close Direct Add Modal on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDirectAdd(false);
      }
    };
    if (showDirectAdd) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDirectAdd]);

  // Select / Deselect All
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(pendingRequests.map(r => r.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number | string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Batch Approval
  const handleApproveSelected = async () => {
    if (!selectedIds.length) return;
    setActionInProgress(true);
    try {
      const { approvedCount, error } = await approveBatchRequests(selectedIds);
      if (error) {
        onShowToast(error, 'error');
      } else {
        onShowToast(
          `Successfully approved and migrated ${approvedCount} cab(s) to production!`,
          'success'
        );
        loadPending(pendingPage);
        loadFleet(fleetPage, fleetSearch);
      }
    } catch {
      onShowToast('Error approving requests', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Batch Rejection
  const handleRejectSelected = async () => {
    if (!selectedIds.length) return;
    setActionInProgress(true);
    try {
      const { rejectedCount, error } = await rejectBatchRequests(selectedIds);
      if (error) {
        onShowToast(error, 'error');
      } else {
        onShowToast(`Rejected and removed ${rejectedCount} request(s).`, 'info');
        loadPending(pendingPage);
      }
    } catch {
      onShowToast('Error rejecting requests', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Single Approve
  const handleSingleApprove = async (id: number | string) => {
    setActionInProgress(true);
    try {
      const { error } = await approveBatchRequests([id]);
      if (error) {
        onShowToast(error, 'error');
        return;
      }
      onShowToast('Cab request approved and moved to active fleet', 'success');
      loadPending(pendingPage);
      loadFleet(fleetPage, fleetSearch);
    } catch {
      onShowToast('Error approving request', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Single Reject
  const handleSingleReject = async (id: number | string) => {
    setActionInProgress(true);
    try {
      const { error } = await rejectBatchRequests([id]);
      if (error) {
        onShowToast(error, 'error');
        return;
      }
      onShowToast('Request rejected', 'info');
      loadPending(pendingPage);
    } catch {
      onShowToast('Error rejecting request', 'error');
    } finally {
      setActionInProgress(false);
    }
  };

  // Delete cab from fleet
  const handleDeleteFleetCab = async (cab: FinalCab) => {
    if (!confirm(`Are you sure you want to remove Cab #${cab.cab_number} (+91 ${cab.driver_number}) from active fleet?`)) {
      return;
    }
    const { success, error } = await deleteFinalCab(cab.id);
    if (!success && error) {
      onShowToast(`Failed to delete cab: ${error}`, 'error');
      return;
    }
    onShowToast(`Cab #${cab.cab_number} removed from active fleet`, 'info');
    loadFleet(fleetPage, fleetSearch);
  };

  // Handle direct fleet cab addition
  const handleDirectAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCab = directCabNo.replace(/\D/g, '').slice(0, 4);
    const cleanPhone = directDriverPhone.replace(/\D/g, '').slice(0, 10);

    if (cleanCab.length !== 4) {
      onShowToast('Cab number must be exactly 4 digits', 'error');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      onShowToast('Valid 10-digit driver mobile (starting with 6-9) is required', 'error');
      return;
    }

    const { error } = await addDirectFinalCab({
      cab_number: cleanCab,
      driver_number: cleanPhone,
      route_area: directRoute
    });

    if (error) {
      onShowToast(`Failed to add cab: ${error}`, 'error');
      return;
    }

    onShowToast(`Cab #${cleanCab} directly added to active production fleet!`, 'success');
    setShowDirectAdd(false);
    setDirectCabNo('');
    setDirectDriverPhone('');
    setDirectRoute('SAR 3');
    loadFleet(1, fleetSearch);
  };

  const pendingTotalPages = Math.max(1, Math.ceil(pendingTotal / PAGE_SIZE));
  const fleetTotalPages = Math.max(1, Math.ceil(fleetTotal / PAGE_SIZE));

  return (
    <div className="max-w-7xl mx-auto px-3.5 sm:px-6 lg:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
      {/* Admin Top Banner */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-4 sm:p-7 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5.5 h-5.5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <h1 className="text-lg sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Fleet Admin Panel
              </h1>
              <span className="text-[11px] font-semibold text-emerald-700">
                · Admin
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 leading-snug">
              Review pending cab requests and manage active fleet numbers
            </p>
          </div>
        </div>

        {/* Tab Controls — Full width 2-column grid on mobile */}
        <div className="grid grid-cols-2 sm:flex p-1 bg-slate-100 rounded-xl w-full lg:w-auto gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`min-h-[44px] px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'pending'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4 text-amber-500 shrink-0" />
            <span className="sm:hidden">Pending</span>
            <span className="hidden sm:inline">Pending Approvals</span>
            <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-mono tabular-nums">
              {pendingTotal}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fleet')}
            className={`min-h-[44px] px-3 sm:px-4 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all whitespace-nowrap ${
              activeTab === 'fleet'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="sm:hidden">Active Fleet</span>
            <span className="hidden sm:inline">Active Fleet Database</span>
            <span className="ml-0.5 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-mono tabular-nums">
              {fleetTotal}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: PENDING APPROVALS */}
      {activeTab === 'pending' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Action Header Bar */}
          <div className="p-3.5 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="flex items-center justify-between sm:justify-start gap-2">
              <span className="text-xs font-bold text-slate-700">
                Staged Requests (<span className="font-mono text-slate-900">unapproved_cabs</span>)
              </span>
              <button
                type="button"
                onClick={() => loadPending(pendingPage)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-700 rounded-xl hover:bg-slate-100 active:bg-slate-200 transition-colors"
                title="Refresh requests"
                aria-label="Refresh pending requests"
              >
                <RefreshCw className={`w-4 h-4 ${loadingPending ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Batch Controls */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto animate-in fade-in">
                <span className="hidden sm:inline text-xs font-semibold text-slate-600">
                  {selectedIds.length} selected:
                </span>
                <button
                  type="button"
                  onClick={handleApproveSelected}
                  disabled={actionInProgress}
                  className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <Check className="w-4 h-4" />
                  <span>Approve ({selectedIds.length})</span>
                </button>
                <button
                  type="button"
                  onClick={handleRejectSelected}
                  disabled={actionInProgress}
                  className="flex-1 sm:flex-initial min-h-[44px] px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
                >
                  <X className="w-4 h-4" />
                  <span>Reject ({selectedIds.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Desktop Table View (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      checked={
                        pendingRequests.length > 0 &&
                        selectedIds.length === pendingRequests.length
                      }
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-4 font-bold text-slate-800">Cab No</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Driver Phone</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Requested By</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {loadingPending ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      Loading pending requests...
                    </td>
                  </tr>
                ) : pendingRequests.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <div className="max-w-sm mx-auto space-y-2">
                        <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                        <div className="text-sm font-bold text-slate-700">All caught up!</div>
                        <p className="text-xs text-slate-400">
                          No pending cab addition or update requests awaiting review.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  pendingRequests.map(req => {
                    const isSelected = selectedIds.includes(req.id);
                    const locationLabel = req.route_area && req.route_area.toLowerCase().includes('3') ? 'SAR 3' : 'SAR 2';
                    return (
                      <tr
                        key={req.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          isSelected ? 'bg-emerald-50/40' : ''
                        }`}
                      >
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelect(req.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer"
                          />
                        </td>
                        <td className="py-3.5 px-4 font-sans tabular-nums font-bold text-slate-900 text-sm">
                          #{req.cab_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                            {locationLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-sans tabular-nums text-slate-700">
                          {req.request_type === 'UPDATE' && req.old_driver_number ? (
                            <div>
                              <span className="text-emerald-700 font-bold">+91 {req.driver_number}</span>
                              <span className="block text-[10px] text-slate-400 line-through">
                                was: +91 {req.old_driver_number}
                              </span>
                            </div>
                          ) : (
                            <span>+91 {req.driver_number}</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                              req.request_type === 'REMOVE'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : req.request_type === 'UPDATE'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            }`}
                          >
                            {req.request_type}
                          </span>
                          {req.notes && (
                            <p className="mt-1 text-[11px] text-slate-600 max-w-[200px] leading-snug break-words">
                              Reason: {req.notes}
                            </p>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 text-[11px] truncate max-w-[150px]">
                          {req.requested_by_email || req.requested_by}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap tabular-nums">
                          {new Date(req.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleSingleApprove(req.id)}
                              disabled={actionInProgress}
                              className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center gap-1"
                              title="Approve & migrate to final_cabs"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Approve</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSingleReject(req.id)}
                              disabled={actionInProgress}
                              className="px-2 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Reject & discard request"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card Layout (< 768px) — 44px+ hit targets, zero horizontal clipping */}
          <div className="md:hidden divide-y divide-slate-100">
            {pendingRequests.length > 0 && (
              <div className="px-3.5 py-1.5 bg-slate-50/80 flex items-center justify-between text-xs border-b border-slate-100">
                <label className="flex items-center gap-2 font-semibold text-slate-700 cursor-pointer min-h-[44px] pr-3">
                  <input
                    type="checkbox"
                    checked={
                      pendingRequests.length > 0 &&
                      selectedIds.length === pendingRequests.length
                    }
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5 cursor-pointer"
                  />
                  <span>Select All ({pendingRequests.length})</span>
                </label>
              </div>
            )}

            {loadingPending ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Loading pending requests...
              </div>
            ) : pendingRequests.length === 0 ? (
              <div className="p-10 text-center text-slate-400">
                <Check className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-700">All caught up!</div>
                <p className="text-xs text-slate-400 mt-1">
                  No pending requests awaiting review.
                </p>
              </div>
            ) : (
              pendingRequests.map(req => {
                const isSelected = selectedIds.includes(req.id);
                const locationLabel = req.route_area && req.route_area.toLowerCase().includes('3') ? 'SAR 3' : 'SAR 2';
                return (
                  <div
                    key={req.id}
                    className={`p-4 space-y-3 ${isSelected ? 'bg-emerald-50/40' : 'bg-white'}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-2.5 cursor-pointer min-h-[44px]">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(req.id)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-5 h-5 cursor-pointer shrink-0"
                        />
                        <span className="font-sans tabular-nums font-bold text-slate-900 text-lg">
                          #{req.cab_number}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {locationLabel}
                        </span>
                      </label>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                          req.request_type === 'REMOVE'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : req.request_type === 'UPDATE'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {req.request_type}
                      </span>
                    </div>

                    <div className="pl-7 space-y-1.5 text-xs">
                      <div className="font-sans tabular-nums text-slate-800 flex items-center gap-1.5 text-sm">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {req.request_type === 'UPDATE' && req.old_driver_number ? (
                          <div>
                            <span className="text-emerald-700 font-bold">+91 {req.driver_number}</span>
                            <span className="block text-[11px] text-slate-400 line-through">
                              was: +91 {req.old_driver_number}
                            </span>
                          </div>
                        ) : (
                          <span className="font-semibold">+91 {req.driver_number}</span>
                        )}
                      </div>
                      {req.notes && (
                        <div className="text-[11px] text-slate-700 bg-rose-50/70 border border-rose-100 rounded-lg px-2.5 py-1.5 leading-snug break-words">
                          <span className="font-semibold text-rose-700">Reason: </span>
                          {req.notes}
                        </div>
                      )}
                      <div className="text-[11px] text-slate-500 flex items-center justify-between gap-2">
                        <span className="truncate">{req.requested_by_email || req.requested_by}</span>
                        <span className="shrink-0 tabular-nums">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleSingleApprove(req.id)}
                        disabled={actionInProgress}
                        className="flex-1 min-h-[44px] py-2 px-3 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSingleReject(req.id)}
                        disabled={actionInProgress}
                        className="min-h-[44px] py-2 px-4 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 active:scale-[0.98] disabled:opacity-50 rounded-xl transition-all flex items-center justify-center gap-1"
                      >
                        <X className="w-4 h-4" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Server-Side Pagination Controls */}
          {pendingTotal > 0 && (
            <div className="p-3.5 sm:p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/30">
              <div className="tabular-nums text-center sm:text-left">
                Showing {(pendingPage - 1) * PAGE_SIZE + 1}–{Math.min(pendingPage * PAGE_SIZE, pendingTotal)} of {pendingTotal} pending
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingPage(p => Math.max(1, p - 1))}
                  disabled={pendingPage === 1}
                  aria-label="Previous page"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium tabular-nums whitespace-nowrap">
                  Page {pendingPage} / {pendingTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPendingPage(p => Math.min(pendingTotalPages, p + 1))}
                  disabled={pendingPage >= pendingTotalPages}
                  aria-label="Next page"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: ACTIVE PRODUCTION FLEET */}
      {activeTab === 'fleet' && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Header & Search */}
          <div className="p-3.5 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
            <div className="relative w-full sm:flex-1 sm:max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                inputMode="search"
                enterKeyHint="search"
                placeholder="Search fleet (cab no or phone)..."
                value={fleetSearch}
                onChange={e => {
                  setFleetSearch(e.target.value);
                  setFleetPage(1);
                  loadFleet(1, e.target.value);
                }}
                className="w-full min-h-[46px] pl-10 pr-3 py-2 text-base sm:text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowDirectAdd(true)}
              className="w-full sm:w-auto min-h-[46px] px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Direct Add Active Cab</span>
            </button>
          </div>

          {/* Desktop Fleet Table (md and up) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-100/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4 font-bold text-slate-800">Cab No</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Driver Phone</th>
                  <th className="py-3 px-4">Last Updated</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingFleet ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      Loading active fleet...
                    </td>
                  </tr>
                ) : fleetCabs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No cabs found matching your search.
                    </td>
                  </tr>
                ) : (
                  fleetCabs.map(cab => {
                    const locationLabel = cab.route_area && cab.route_area.toLowerCase().includes('3') ? 'SAR 3' : 'SAR 2';
                    return (
                      <tr key={cab.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-sans tabular-nums font-bold text-slate-900 text-sm">
                          #{cab.cab_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                            {locationLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-sans tabular-nums text-slate-700">
                          +91 {cab.driver_number}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400 text-[11px] tabular-nums">
                          {new Date(cab.updated_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteFleetCab(cab)}
                            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Delete from active directory"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Fleet Card Layout (< 768px) */}
          <div className="md:hidden divide-y divide-slate-100">
            {loadingFleet ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Loading active fleet...
              </div>
            ) : fleetCabs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No cabs found matching your search.
              </div>
            ) : (
              fleetCabs.map(cab => {
                const locationLabel = cab.route_area && cab.route_area.toLowerCase().includes('3') ? 'SAR 3' : 'SAR 2';
                return (
                  <div key={cab.id} className="p-4 flex items-center justify-between gap-3 bg-white">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-sans tabular-nums font-bold text-slate-900 text-lg">
                          #{cab.cab_number}
                        </span>
                        <span className="px-2 py-0.5 text-[11px] font-semibold rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                          {locationLabel}
                        </span>
                      </div>
                      <a
                        href={`tel:${cab.driver_number.replace(/\D/g, '')}`}
                        className="font-sans tabular-nums text-sm text-emerald-700 font-semibold flex items-center gap-1.5 py-0.5"
                      >
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span>+91 {cab.driver_number}</span>
                      </a>
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        Updated: {new Date(cab.updated_at).toLocaleDateString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteFleetCab(cab)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-rose-600 bg-rose-50 hover:bg-rose-100 active:scale-[0.96] rounded-xl transition-all shrink-0"
                      title="Delete from active directory"
                      aria-label={`Delete Cab #${cab.cab_number}`}
                    >
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Fleet Pagination */}
          {fleetTotal > 0 && (
            <div className="p-3.5 sm:p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/30">
              <div className="tabular-nums text-center sm:text-left">
                Showing {(fleetPage - 1) * PAGE_SIZE + 1}–{Math.min(fleetPage * PAGE_SIZE, fleetTotal)} of {fleetTotal} active cabs
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFleetPage(p => Math.max(1, p - 1))}
                  disabled={fleetPage === 1}
                  aria-label="Previous fleet page"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 font-medium tabular-nums whitespace-nowrap">
                  Page {fleetPage} / {fleetTotalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setFleetPage(p => Math.min(fleetTotalPages, p + 1))}
                  disabled={fleetPage >= fleetTotalPages}
                  aria-label="Next fleet page"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct Add Modal — Compact Centered & Scrollable */}
      {showDirectAdd && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto"
          onClick={e => {
            if (e.target === e.currentTarget) setShowDirectAdd(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-sm sm:max-w-md w-full my-auto overflow-hidden flex flex-col max-h-[82dvh]">
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 shrink-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Directly Add Active Fleet Cab
              </h3>
              <button
                type="button"
                onClick={() => setShowDirectAdd(false)}
                aria-label="Close modal"
                className="min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-600 active:bg-slate-100 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              id="admin-direct-add-form"
              onSubmit={handleDirectAddSubmit}
              className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto overscroll-contain space-y-3.5 text-xs"
            >
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Cab Number (4 Digits) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  maxLength={4}
                  placeholder="e.g. 3545"
                  value={directCabNo}
                  onChange={e => setDirectCabNo(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full min-h-[48px] px-3.5 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 font-sans tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Driver Mobile (10 Digits) <span className="text-rose-500">*</span>
                </label>
                <div className="flex">
                  <span className="inline-flex items-center px-3.5 rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 text-slate-600 text-sm sm:text-xs font-sans">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="tel"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={directDriverPhone}
                    onChange={e => setDirectDriverPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="w-full min-h-[48px] px-3.5 py-2.5 text-base sm:text-sm rounded-r-xl border border-slate-200 font-sans tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Location (SAR 2 or SAR 3) <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['SAR 3', 'SAR 2'] as const).map(loc => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setDirectRoute(loc)}
                      className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold border transition-all active:scale-[0.98] ${
                        directRoute === loc
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </div>
            </form>

            <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50/90 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setShowDirectAdd(false)}
                className="min-h-[48px] px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="admin-direct-add-form"
                className="flex-1 min-h-[48px] px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] rounded-xl shadow-xs transition-all"
              >
                Add to Production Fleet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
