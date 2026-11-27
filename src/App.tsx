import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, FinalCab, ToastMessage } from './types';
import { fetchCurrentUser, signOutUser, supabase, pingSupabaseKeepAlive, isRealSupabaseConnected, isRegistrationInProgress } from './services/supabase';
import { Navbar, MobileBottomNav } from './components/common/Navbar';
import { Footer } from './components/common/Footer';
import { ToastContainer } from './components/common/Toast';
import { SupabaseConfigModal } from './components/common/SupabaseConfigModal';
import { AuthPage } from './components/auth/AuthPage';
import { SearchDashboard } from './components/employee/SearchDashboard';
import { CabRequestModal } from './components/employee/CabRequestModal';
import { ReportWrongModal } from './components/employee/ReportWrongModal';
import { AdminPanel } from './components/admin/AdminPanel';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(() => isRealSupabaseConnected());
  const [currentView, setCurrentView] = useState<'search' | 'admin'>('search');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Modals
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [isDbConfigOpen, setIsDbConfigOpen] = useState(false);
  const [reportingCab, setReportingCab] = useState<FinalCab | null>(null);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
    setToasts(prev => [...prev, { id, message, type }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Auth Success Handler (Role-based auto routing)
  const handleAuthSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
    if (profile.role === 'admin') {
      setCurrentView('admin');
    } else {
      setCurrentView('search');
    }
  };

  // Listen for live Supabase session changes directly from DB
  useEffect(() => {
    const client = supabase;
    if (!client) {
      setAuthChecking(false);
      return;
    }

    fetchCurrentUser()
      .then(profile => {
        if (profile) {
          handleAuthSuccess(profile);
        }
      })
      .finally(() => {
        setAuthChecking(false);
      });

    const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
      if (isRegistrationInProgress()) return; // don't auto-login right after registering
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        const { data: profileData } = await client
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        const profile: UserProfile = {
          id: session.user.id,
          personal_email: profileData?.personal_email || session.user.email || '',
          employee_id: profileData?.employee_id || session.user.user_metadata?.employee_id || null,
          role: profileData?.role === 'admin' ? 'admin' : 'employee',
          full_name: profileData?.full_name || session.user.user_metadata?.full_name,
          phone_number: profileData?.phone_number
        };

        handleAuthSuccess(profile);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setCurrentView('search');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Supabase Free-Tier Keep-Alive Ping (prevents 7-day inactivity pause)
  useEffect(() => {
    pingSupabaseKeepAlive();
    const interval = setInterval(() => {
      pingSupabaseKeepAlive();
    }, 6 * 60 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  // Sign out
  const handleSignOut = async () => {
    await signOutUser();
    setCurrentUser(null);
    setCurrentView('search');
    showToast('Signed out of CabFinder', 'info');
  };

  // Quick view toggle between Admin Approvals and Employee Directory (for admin users)
  const handleQuickToggleRole = () => {
    if (!currentUser || currentUser.role !== 'admin') return;
    const nextView = currentView === 'admin' ? 'search' : 'admin';
    setCurrentView(nextView);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Switched view to ${nextView === 'admin' ? 'Admin Approvals' : 'Employee Directory'}`, 'info');
  };

  const handleNavigateView = (view: 'search' | 'admin') => {
    setCurrentView(view);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authChecking) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 text-slate-600 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Connecting to database...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show Auth Page
  if (!currentUser) {
    return (
      <div className="min-h-[100dvh] bg-slate-50 text-slate-900 flex flex-col justify-between">
        <AuthPage onAuthSuccess={handleAuthSuccess} onShowToast={showToast} />
        <Footer />
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-hidden md:h-auto md:min-h-[100dvh] md:overflow-visible bg-slate-50 text-slate-900 flex flex-col selection:bg-emerald-500/20 selection:text-emerald-900">
      {/* Pinned Top Bar */}
      <Navbar
        user={currentUser}
        currentView={currentView}
        onChangeView={handleNavigateView}
        onRequestCab={() => setIsRequestModalOpen(true)}
        onOpenDbConfig={() => setIsDbConfigOpen(true)}
        onSignOut={handleSignOut}
        onQuickToggleRole={handleQuickToggleRole}
      />

      {/* Middle Scrollable Content Region on Mobile */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain md:overflow-visible flex flex-col"
      >
        <main className="flex-1 pb-4 sm:pb-8">
          {currentView === 'admin' && currentUser.role === 'admin' ? (
            <AdminPanel onShowToast={showToast} />
          ) : (
            <SearchDashboard
              onOpenRequestModal={() => setIsRequestModalOpen(true)}
              onReportWrongNumber={cab => setReportingCab(cab)}
              onShowToast={showToast}
            />
          )}
        </main>

        {/* Small Clean Footer */}
        <Footer />
      </div>

      {/* Permanently Pinned Bottom Thumb Bar on Mobile */}
      <MobileBottomNav
        user={currentUser}
        currentView={currentView}
        onSelectSearch={() => handleNavigateView('search')}
        onRequestCab={() => setIsRequestModalOpen(true)}
        onSelectAdmin={() => handleNavigateView('admin')}
        onOpenDbConfig={() => setIsDbConfigOpen(true)}
      />

      {/* Dual-Option Cab Request Modal (Dynamic rows + Bulk CSV) */}
      <CabRequestModal
        isOpen={isRequestModalOpen}
        userId={currentUser.id}
        userEmail={currentUser.personal_email}
        onClose={() => setIsRequestModalOpen(false)}
        onSuccess={() => {}}
        onShowToast={showToast}
      />

      {/* Report Wrong / Driver Outdated Modal */}
      <ReportWrongModal
        cab={reportingCab}
        userId={currentUser.id}
        userEmail={currentUser.personal_email}
        onClose={() => setReportingCab(null)}
        onSuccess={() => {}}
        onShowToast={showToast}
      />

      {/* Supabase Database Schema & Setup Modal (Admin only) */}
      {currentUser.role === 'admin' && (
        <SupabaseConfigModal
          isOpen={isDbConfigOpen}
          onClose={() => setIsDbConfigOpen(false)}
          onShowToast={showToast}
        />
      )}

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
