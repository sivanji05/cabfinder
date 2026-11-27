import React, { useState } from 'react';
import { Lock, Mail, ArrowRight, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import {
  signInDirect,
  signUpDirect
} from '../../services/supabase';
import { UserProfile } from '../../types';
import { CabFinderLogo } from '../common/CabFinderLogo';
import { IdBadgeIcon } from '../common/IdBadgeIcon';

interface AuthPageProps {
  onAuthSuccess: (profile: UserProfile, needsEmployeeId?: boolean) => void;
  onShowToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onAuthSuccess, onShowToast }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [registeredNotice, setRegisteredNotice] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanEmail = email.trim().toLowerCase();
    const cleanEmpId = employeeId.trim();

    if (mode === 'signup') {
      const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
      if (!gmailRegex.test(cleanEmail)) {
        setErrorMsg('Personal email format must end with @gmail.com (e.g., yourname@gmail.com).');
        return;
      }

      if (!/^\d{8}$/.test(cleanEmpId)) {
        setErrorMsg('Employee ID must and should be exactly 8 digits (numbers only, e.g., 10245678).');
        return;
      }

      if (password.length < 8) {
        setErrorMsg('Password must be at least 8 characters long (supports letters, numbers, or symbols).');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'signup') {
        const { profile, error, emailConfirmationRequired } = await signUpDirect(cleanEmail, cleanEmpId, password);
        if (error) {
          setErrorMsg(error);
          setRegisteredNotice('');
          onShowToast(error, 'error');
        } else if (profile) {
          setMode('login');
          setPassword('');
          setShowPassword(false);
          setErrorMsg('');
          if (emailConfirmationRequired) {
            setRegisteredNotice(
              `Registration submitted for Employee #${profile.employee_id}! If "Confirm email" is enabled in your Supabase project, check your email to verify before signing in (or disable "Confirm email" in Supabase Auth to sign in immediately).`
            );
            onShowToast('Account registered! Please verify email or sign in.', 'info');
          } else {
            setRegisteredNotice(
              `Registration successful for Employee #${profile.employee_id}! You can now sign in using your Email or Employee ID (${profile.employee_id}).`
            );
            onShowToast('Registration successful! Please sign in with your password to continue.', 'success');
          }
        }
      } else {
        const cleanIdentifier = email.trim();
        if (!cleanIdentifier || !password) {
          setErrorMsg('Please enter your Email or Employee ID, and Password.');
          return;
        }
        const { profile, error } = await signInDirect(cleanIdentifier, password);
        if (error) {
          setErrorMsg(error);
          onShowToast(error, 'error');
        } else if (profile) {
          setRegisteredNotice('');
          onShowToast(`Welcome back, ${profile.employee_id || 'Colleague'}!`, 'success');
          onAuthSuccess(profile);
        }
      }
    } catch {
      setErrorMsg('Failed to process authentication request. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-50 flex flex-col justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
      {/* Brand Header */}
      <div className="mx-auto w-full max-w-md text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-600 text-white shadow-sm mb-3 sm:mb-4">
          <CabFinderLogo className="w-7 h-7" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          CabFinder
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 max-w-xs sm:max-w-none mx-auto">
          Find your cab in seconds
        </p>
      </div>

      {/* Main Auth Card */}
      <div className="mt-5 sm:mt-8 mx-auto w-full max-w-md">
        <div className="bg-white py-6 px-4 sm:py-8 sm:px-10 rounded-2xl border border-slate-200 shadow-sm space-y-5 sm:space-y-6">
          {/* Heading (changes with the mode) */}
          <div className="text-center">
            <h2 className="text-lg sm:text-xl font-bold text-slate-700">
              {mode === 'login' ? 'Sign in to your account' : 'Create your account'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              {mode === 'login'
                ? ''
                : 'Register with your Employee ID and personal Gmail.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {registeredNotice && mode === 'login' && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs space-y-1 animate-in fade-in">
                <div className="flex items-center gap-2 font-semibold text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Registration Complete!</span>
                </div>
                <p className="text-emerald-700 leading-relaxed">
                  {registeredNotice}
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs leading-relaxed">
                {errorMsg}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {mode === 'login' ? 'Email or Employee ID' : 'Personal Email'}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                {mode === 'login' ? (
                  email.includes('@') ? (
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  ) : (
                    <IdBadgeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  )
                ) : (
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                )}
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  inputMode={mode === 'login' ? 'text' : 'email'}
                  autoComplete={mode === 'login' ? 'username' : 'email'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  required
                  placeholder={
                    mode === 'login'
                      ? '10245678'
                      : 'name@gmail.com'
                  }
                  value={email}
                  onChange={e => {
                    setEmail(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full min-h-[48px] pl-10 pr-3 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
              </div>
              {mode === 'login' ? (
                <div className="flex items-start gap-1.5 text-[11px] text-slate-500 mt-1.5">
                  <IdBadgeIcon className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    Enter your <span className="font-semibold text-slate-700">8-digit Employee ID</span> or registered <span className="font-semibold text-slate-700">Email</span>.
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Format must strictly end with <span className="font-semibold text-slate-700">@gmail.com</span>
                </p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Employee ID (8 Digits) <span className="text-rose-500">*</span>
                  </label>
                  <span
                    className={`text-[10px] font-mono tabular-nums font-semibold ${
                      employeeId.length === 8 ? 'text-emerald-700 font-bold' : 'text-slate-400'
                    }`}
                  >
                    {employeeId.length === 8 ? '8/8 Digits' : `${employeeId.length}/8 digits`}
                  </span>
                </div>
                <div className="relative">
                  <IdBadgeIcon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    autoComplete="off"
                    enterKeyHint="next"
                    required
                    placeholder="10245678"
                    value={employeeId}
                    onChange={e => {
                      const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setEmployeeId(digitsOnly);
                      setErrorMsg('');
                    }}
                    className="w-full min-h-[48px] pl-10 pr-3 py-2.5 text-base sm:text-sm font-mono tabular-nums tracking-wider rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Must and should be exactly 8 numbers (0-9).
                </p>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Password {mode === 'signup' ? '(Min 8 chars)' : ''} <span className="text-rose-500">*</span>
                </label>
                {mode === 'signup' && (
                  <span
                    className={`text-[10px] font-mono tabular-nums font-semibold ${
                      password.length >= 8 ? 'text-emerald-600' : 'text-slate-400'
                    }`}
                  >
                    {password.length >= 8 ? '✓ Valid (≥8)' : `${password.length}/8 min`}
                  </span>
                )}
              </div>
              <div className="relative">
                <Lock
                  className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                    password.length >= 8 ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  enterKeyHint="go"
                  required
                  minLength={mode === 'signup' ? 8 : undefined}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setErrorMsg('');
                  }}
                  className="w-full min-h-[48px] pl-10 pr-12 py-2.5 text-base sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-xl transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Supports letters, numbers, or symbols (minimum 8 characters).
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[48px] h-12 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] disabled:opacity-50 rounded-xl shadow-xs transition-all mt-2"
            >
              <span>{loading ? 'Authenticating...' : mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Switch between Sign In and Register */}
          <p className="text-center text-sm text-slate-600">
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login');
                setErrorMsg('');
                setRegisteredNotice('');
                setEmail('');
                setEmployeeId('');
                setPassword('');
                setShowPassword(false);
              }}
              className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline underline-offset-2"
            >
              {mode === 'login' ? 'Register' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};
