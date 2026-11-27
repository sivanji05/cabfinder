import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { UserProfile, FinalCab, UnapprovedCab, CabRequestType, RouteArea } from '../types';

// ==========================================
// SUPABASE CLIENT INITIALIZATION
// ==========================================

const getStoredConfig = () => {
  const url = localStorage.getItem('cabfinder_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('cabfinder_supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return { url: url.trim(), key: key.trim() };
};

let { url: supabaseUrl, key: supabaseAnonKey } = getStoredConfig();

export let supabase: SupabaseClient | null = null;
if (supabaseUrl && supabaseAnonKey && supabaseUrl.startsWith('http')) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn('Invalid Supabase configuration provided:', err);
    supabase = null;
  }
}

// Clean up any legacy browser local-storage test data
if (typeof window !== 'undefined') {
  [
    'profiles',
    'final_cabs',
    'unapproved_cabs',
    'user_passwords',
    'active_user',
    'recent_searches',
    'last_keepalive'
  ].forEach(key => {
    try {
      localStorage.removeItem('cabfinder_' + key);
    } catch {
      // Ignore storage access errors
    }
  });
}

export const isRealSupabaseConnected = (): boolean => {
  return !!supabase;
};

export const updateSupabaseCredentials = (url: string, key: string) => {
  localStorage.setItem('cabfinder_supabase_url', url.trim());
  localStorage.setItem('cabfinder_supabase_anon_key', key.trim());
  window.location.reload();
};

export const clearSupabaseCredentials = () => {
  localStorage.removeItem('cabfinder_supabase_url');
  localStorage.removeItem('cabfinder_supabase_anon_key');
  window.location.reload();
};

/**
 * Lightweight Keep-Alive ping to Supabase REST endpoint.
 * Calling this resets the 7-day inactivity pause counter on Supabase Free Tier.
 */
export async function pingSupabaseKeepAlive(): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.from('final_cabs').select('id').limit(1);
    if (!error) {
      return true;
    }
  } catch (err) {
    console.debug('Keep-alive ping notice:', err);
  }
  return false;
}

// ==========================================
// LIVE SUPABASE SESSION & PROFILE LOOKUP
// ==========================================

export async function fetchCurrentUser(): Promise<UserProfile | null> {
  if (!supabase) return null;
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session?.user) return null;

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .maybeSingle();

    return {
      id: session.user.id,
      personal_email: profileData?.personal_email || session.user.email || '',
      employee_id: profileData?.employee_id || session.user.user_metadata?.employee_id || null,
      role: profileData?.role === 'admin' ? 'admin' : 'employee',
      full_name: profileData?.full_name || session.user.user_metadata?.full_name,
      phone_number: profileData?.phone_number
    };
  } catch {
    return null;
  }
}

// ==========================================
// AUTHENTICATION SERVICES (STRICT & SECURE)
// ==========================================

/**
 * Sign In with Email or Employee ID and Password.
 * Queries Supabase Auth and validates role directly from public.profiles table.
 * NO client-side role hardcoding or email substring backdoors.
 */
export async function signInDirect(
  identifier: string,
  password: string
): Promise<{ profile: UserProfile | null; error: string | null }> {
  const cleanInput = identifier.trim();
  const cleanLower = cleanInput.toLowerCase();
  const isEmail = cleanInput.includes('@');

  if (!supabase) {
    return {
      profile: null,
      error: 'Database is not connected. Please configure your Supabase URL and Anon Key first.'
    };
  }

  try {
    // If user signed in with Employee ID, authenticate server-side via Edge Function (no email enumeration)
    if (!isEmail) {
      if (!/^\d{8}$/.test(cleanInput)) {
        return {
          profile: null,
          error: 'Please enter a valid 8-digit Employee ID or your registered email address.'
        };
      }

      try {
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('employee-login', {
          body: { employee_id: cleanInput, password }
        });

        if (!fnErr && fnData?.session && fnData?.profile) {
          await supabase.auth.setSession({
            access_token: fnData.session.access_token,
            refresh_token: fnData.session.refresh_token
          });
          return { profile: fnData.profile, error: null };
        }

        // If Edge Function explicitly returned 400/401 invalid credentials
        if (fnErr && (fnErr as any)?.context?.status === 401) {
          return {
            profile: null,
            error: 'Invalid Employee ID or password. Please check your credentials.'
          };
        }
      } catch {
        // Edge function may not be deployed yet; fall through to synthetic login attempt
      }

      return {
        profile: null,
        error: 'Employee ID login is not available right now (the "employee-login" Edge Function is not deployed). Please sign in with your registered email instead.'
      };
    }

    // Direct Email + Password Sign In
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanLower,
      password
    });

    if (error) {
      return { profile: null, error: error.message };
    }

    if (!data.user) {
      return { profile: null, error: 'Authentication failed. Please try again.' };
    }

    // Fetch authenticated profile from database - ROLE COMES EXCLUSIVELY FROM DATABASE
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileErr || !profileData) {
      const fallbackProfile: UserProfile = {
        id: data.user.id,
        personal_email: data.user.email || cleanLower,
        employee_id: data.user.user_metadata?.employee_id || null,
        role: 'employee'
      };
      return { profile: fallbackProfile, error: null };
    }

    const userProfile: UserProfile = {
      id: profileData.id,
      personal_email: profileData.personal_email,
      employee_id: profileData.employee_id,
      role: profileData.role === 'admin' ? 'admin' : 'employee',
      full_name: profileData.full_name,
      phone_number: profileData.phone_number
    };

    return { profile: userProfile, error: null };
  } catch (e: any) {
    return { profile: null, error: e.message || 'Database connection error during sign in.' };
  }
}


/**
 * Direct Sign Up with Email, 8-Digit Employee ID, and Password.
 * Role defaults strictly to 'employee'. No role parameter accepted.
 */
// While signing up we must NOT auto-login the new user (Supabase returns a session when "Confirm email" is OFF).
let registrationInProgress = false;
export const isRegistrationInProgress = () => registrationInProgress;

export async function signUpDirect(
  email: string,
  employeeId: string,
  password: string
): Promise<{ profile: UserProfile | null; error: string | null; emailConfirmationRequired?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanEmpId = employeeId.trim();

  if (!cleanEmail || !cleanEmpId || !password) {
    return { profile: null, error: 'Please enter all required fields.' };
  }

  // 1. Personal Email format check: must end with @gmail.com
  const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;
  if (!gmailRegex.test(cleanEmail)) {
    return {
      profile: null,
      error: 'Invalid email format: Personal email must end with @gmail.com (e.g., name@gmail.com).'
    };
  }

  // 2. Employee ID format check: exactly 8 digits
  if (!/^\d{8}$/.test(cleanEmpId)) {
    return {
      profile: null,
      error: 'Invalid Employee ID: Must be exactly 8 numeric digits (e.g., 10245678).'
    };
  }

  // 3. Password length check: at least 8 characters
  if (password.length < 8) {
    return {
      profile: null,
      error: 'Password too short: Must be at least 8 characters.'
    };
  }

  if (!supabase) {
    return {
      profile: null,
      error: 'Database is not connected. Please configure your Supabase URL and Anon Key first.'
    };
  }

  registrationInProgress = true;
  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          employee_id: cleanEmpId,
          role: 'employee'
        }
      }
    });

    if (error) {
      const errMsg = error.message || '';
      if (/database error saving new user/i.test(errMsg)) {
        const { error: schemaCheckErr } = await supabase.from('profiles').select('id').limit(1);
        if (schemaCheckErr) {
          return {
            profile: null,
            error: `Supabase database schema error (${schemaCheckErr.message}). Please run the latest SQL schema in Supabase SQL Editor.`
          };
        }
        return {
          profile: null,
          error:
            'This Employee ID is already registered (or the Supabase signup trigger failed — check Authentication Logs & run the latest SQL schema).'
        };
      }
      if (/employee_id|duplicate key/i.test(errMsg)) {
        return {
          profile: null,
          error: 'This Employee ID is already registered. Please sign in or use a different Employee ID.'
        };
      }
      if (/already registered|already exists/i.test(errMsg)) {
        return {
          profile: null,
          error: 'An account with this email is already registered. Please sign in.'
        };
      }
      return { profile: null, error: errMsg };
    }

    if (data.user) {
      const newProfile: UserProfile = {
        id: data.user.id,
        personal_email: cleanEmail,
        employee_id: cleanEmpId,
        role: 'employee'
      };

      // The on_auth_user_created trigger already created the profile row (SECURITY DEFINER).
      const isEmailConfirmPending =
        !data.session && (!data.user.confirmed_at && !data.user.email_confirmed_at);

      // Do not keep the user logged in after registering: sign out so they go to the Sign In screen.
      if (data.session) {
        await supabase.auth.signOut();
      }

      return {
        profile: newProfile,
        error: null,
        emailConfirmationRequired: isEmailConfirmPending
      };
    }

    return { profile: null, error: 'Registration failed. Please try again.' };
  } catch (e: any) {
    const msg = e?.message || 'Database error during sign up.';
    if (/database error saving new user|employee_id|duplicate/i.test(msg)) {
      return {
        profile: null,
        error: 'This Employee ID is already registered. Please sign in or use a different Employee ID.'
      };
    }
    return { profile: null, error: msg };
  } finally {
    registrationInProgress = false;
  }
}

export async function updateEmployeeId(userId: string, employeeId: string): Promise<boolean> {
  if (!supabase) return false;
  const cleanEmpId = employeeId.trim();
  const { error } = await supabase
    .from('profiles')
    .update({ employee_id: cleanEmpId })
    .eq('id', userId);

  if (error) {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      const { error: upsertErr } = await supabase.from('profiles').upsert({
        id: userId,
        personal_email: authData.user.email || '',
        employee_id: cleanEmpId,
        role: 'employee'
      });
      return !upsertErr;
    }
    return false;
  }
  return true;
}

export async function signOutUser(): Promise<void> {
  if (supabase) {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
  }
}

// ==========================================
// CAB SEARCH & FLEET MANAGEMENT (DIRECT TO SUPABASE)
// ==========================================

/**
 * Search active production cabs by 4-digit cab number.
 * Live Supabase query directly without caching or local storage.
 */
export async function searchFinalCabs(cabNumber: string): Promise<FinalCab[]> {
  const clean = cabNumber.replace(/\D/g, '').slice(0, 4);
  if (!clean) return [];
  if (!supabase) {
    throw new Error('Database not connected.');
  }

  const { data, error } = await supabase
    .from('final_cabs')
    .select('*')
    .eq('cab_number', clean);

  if (error) {
    throw new Error(error.message);
  }
  return ((data || []) as any[]).map(row => ({
    ...row,
    route_area: row.route_area && String(row.route_area).toUpperCase().includes('3') ? 'SAR 3' : 'SAR 2'
  })) as FinalCab[];
}

/**
 * Submit cab addition or update requests to unapproved_cabs staging table.
 * Live Supabase write with strict route_area ('SAR 2' or 'SAR 3').
 * Propagates actual database errors. Does NOT swallow failures.
 */
export async function submitCabRequests(
  requests: Array<{
    cab_number: string;
    driver_name?: string | null;
    driver_number: string;
    old_driver_number?: string | null;
    request_type?: CabRequestType;
    vehicle_model?: string;
    route_area?: RouteArea | string;
    notes?: string | null;
  }>,
  requestedByUserId: string,
  requestedByUserEmail?: string
): Promise<{ count: number; skippedCount?: number; error: string | null }> {
  if (!requests.length) return { count: 0, skippedCount: 0, error: 'No cab details provided' };

  const hasNotes = requests.some(req => Boolean(req.notes?.trim()));

  const dbRows = requests.map(req => {
    const rawRoute = (req.route_area || '').trim().toUpperCase();
    const route: RouteArea = rawRoute.includes('2') ? 'SAR 2' : 'SAR 3';
    const trimmedNotes = req.notes?.trim().slice(0, 200) || null;
    return {
      cab_number: req.cab_number.replace(/\D/g, '').slice(0, 4),
      driver_name: req.driver_name?.trim() || null,
      driver_number: req.driver_number.replace(/\D/g, '').slice(0, 10),
      old_driver_number: req.old_driver_number ? req.old_driver_number.replace(/\D/g, '').slice(0, 10) : null,
      request_type: req.request_type || 'ADD',
      requested_by: requestedByUserId,
      route_area: route,
      ...(hasNotes ? { notes: trimmedNotes } : {})
    };
  });

  // Deduplicate within the incoming batch before hitting DB
  const seenKeys = new Set<string>();
  const uniqueBatchRows: typeof dbRows = [];
  for (const row of dbRows) {
    const k = `${row.cab_number}_${row.driver_number}_${row.request_type}`;
    if (!seenKeys.has(k)) {
      seenKeys.add(k);
      uniqueBatchRows.push(row);
    }
  }

  if (!supabase) {
    return { count: 0, skippedCount: 0, error: 'Database not connected. Please configure Supabase credentials.' };
  }

  try {
    // Use upsert with ignoreDuplicates so duplicate rows in a batch are skipped instead of aborting the whole batch
    const { data: insertedRows, error } = await supabase
      .from('unapproved_cabs')
      .upsert(uniqueBatchRows, {
        onConflict: 'cab_number,driver_number,request_type',
        ignoreDuplicates: true
      })
      .select();

    if (error) {
      return { count: 0, skippedCount: 0, error: `Database submission error: ${error.message}` };
    }

    const insertedCount = insertedRows?.length || 0;
    const skippedCount = dbRows.length - insertedCount;

    if (insertedCount === 0) {
      return {
        count: 0,
        skippedCount,
        error: 'Duplicate request: Pending review(s) for these cab & contact details are already in the approval queue.'
      };
    }

    return { count: insertedCount, skippedCount, error: null };
  } catch (e: any) {
    return { count: 0, skippedCount: 0, error: e.message || 'Network failure submitting requests to database.' };
  }
}

/**
 * Query pending requests for Admin approval table with pagination and server-side counts.
 */
export async function getPendingRequests(
  page: number = 1,
  pageSize: number = 10
): Promise<{ data: UnapprovedCab[]; totalCount: number; error: string | null }> {
  if (!supabase) {
    return { data: [], totalCount: 0, error: 'Database not connected. Please configure Supabase credentials.' };
  }

  try {
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;
    const { data, count, error } = await supabase
      .from('unapproved_cabs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      return { data: [], totalCount: 0, error: error.message };
    }
    const mapped = ((data || []) as any[]).map(row => ({
      ...row,
      route_area: row.route_area && String(row.route_area).toUpperCase().includes('3') ? 'SAR 3' : 'SAR 2'
    })) as UnapprovedCab[];
    return { data: mapped, totalCount: count || 0, error: null };
  } catch (e: any) {
    return { data: [], totalCount: 0, error: e.message || 'Database query error.' };
  }
}

/**
 * Atomic batch approval of cab requests (runs inside one database transaction).
 * Uses the admin-only SQL function public.approve_cab_requests(ids).
 */
export async function approveBatchRequests(
  ids: Array<number | string>
): Promise<{ approvedCount: number; error: string | null }> {
  if (!ids.length) return { approvedCount: 0, error: null };
  if (!supabase) {
    return { approvedCount: 0, error: 'Database not connected. Please configure Supabase credentials.' };
  }

  try {
    const { data, error } = await supabase.rpc('approve_cab_requests', { p_ids: ids });
    if (error) {
      return { approvedCount: 0, error: `Approval failed: ${error.message}` };
    }
    return { approvedCount: (data as number) ?? 0, error: null };
  } catch (e: any) {
    return { approvedCount: 0, error: e.message || 'Unexpected error during batch approval.' };
  }
}

/**
 * Batch rejection of cab requests via the admin-only SQL function public.reject_cab_requests(ids).
 */
export async function rejectBatchRequests(
  ids: Array<number | string>
): Promise<{ rejectedCount: number; error: string | null }> {
  if (!ids.length) return { rejectedCount: 0, error: null };
  if (!supabase) {
    return { rejectedCount: 0, error: 'Database not connected. Please configure Supabase credentials.' };
  }

  try {
    const { data, error } = await supabase.rpc('reject_cab_requests', { p_ids: ids });
    if (error) {
      return { rejectedCount: 0, error: `Failed to reject requests: ${error.message}` };
    }
    return { rejectedCount: (data as number) ?? 0, error: null };
  } catch (e: any) {
    return { rejectedCount: 0, error: e.message || 'Database error during rejection.' };
  }
}

/**
 * Query active production fleet directly from Supabase final_cabs table with search and pagination.
 */
export async function getAllFinalCabs(
  page: number = 1,
  pageSize: number = 10,
  searchQuery: string = ''
): Promise<{ data: FinalCab[]; totalCount: number; error: string | null }> {
  if (!supabase) {
    return { data: [], totalCount: 0, error: 'Database not connected. Please configure Supabase credentials.' };
  }

  try {
    const from = (page - 1) * pageSize;
    const to = page * pageSize - 1;

    let q = supabase
      .from('final_cabs')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false });

    if (searchQuery.trim()) {
      const clean = searchQuery.trim();
      q = q.or(`cab_number.ilike.%${clean}%,driver_number.ilike.%${clean}%,route_area.ilike.%${clean}%`);
    }

    const { data, count, error } = await q.range(from, to);
    if (error) {
      return { data: [], totalCount: 0, error: error.message };
    }
    const mapped = ((data || []) as any[]).map(row => ({
      ...row,
      route_area: row.route_area && String(row.route_area).toUpperCase().includes('3') ? 'SAR 3' : 'SAR 2'
    })) as FinalCab[];
    return { data: mapped, totalCount: count || 0, error: null };
  } catch (e: any) {
    return { data: [], totalCount: 0, error: e.message || 'Database query error.' };
  }
}

/**
 * Delete a cab directly from final_cabs in Supabase.
 */
export async function deleteFinalCab(id: string): Promise<{ success: boolean; error: string | null }> {
  if (!supabase) {
    return { success: false, error: 'Database not connected. Please configure Supabase credentials.' };
  }

  try {
    const { error } = await supabase.from('final_cabs').delete().eq('id', id);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, error: null };
  } catch (e: any) {
    return { success: false, error: e.message || 'Delete operation failed.' };
  }
}

/**
 * Direct Add a cab to final_cabs (Admin only).
 * Payload strictly includes route_area with 'SAR 2' or 'SAR 3'.
 */
export async function addDirectFinalCab(cab: {
  cab_number: string;
  driver_name?: string | null;
  driver_number: string;
  route_area?: RouteArea | string;
}): Promise<{ data: FinalCab | null; error: string | null }> {
  if (!supabase) {
    return { data: null, error: 'Database not connected. Please configure Supabase credentials.' };
  }

  const rawRoute = (cab.route_area || '').trim().toUpperCase();
  const route: RouteArea = rawRoute.includes('3') ? 'SAR 3' : 'SAR 2';
  const now = new Date().toISOString();

  try {
    const { data, error } = await supabase
      .from('final_cabs')
      .insert([
        {
          cab_number: cab.cab_number.replace(/\D/g, '').slice(0, 4),
          driver_name: cab.driver_name?.trim() || null,
          driver_number: cab.driver_number.replace(/\D/g, '').slice(0, 10),
          route_area: route,
          updated_at: now
        }
      ])
      .select()
      .single();

    if (error) {
      return { data: null, error: error.message };
    }
    return {
      data: {
        ...data,
        route_area: data.route_area && String(data.route_area).toUpperCase().includes('3') ? 'SAR 3' : 'SAR 2'
      } as FinalCab,
      error: null
    };
  } catch (e: any) {
    return { data: null, error: e.message || 'Failed to insert cab directly.' };
  }
}

// ==========================================
// SUPABASE SECURE SQL SCHEMA & RLS DEFINITIONS
// ==========================================

export const SUPABASE_SQL_SCHEMA = `-- ==============================================================
-- CabFinder Production Database Schema, Hardened RLS & Triggers (FIXED)
-- Solves policy infinite recursion via SECURITY DEFINER is_admin()
-- Execute this script in your Supabase Project -> SQL Editor
-- ==============================================================

-- 1. Profiles Table (User role & corporate identity)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  personal_email TEXT NOT NULL,
  employee_id TEXT UNIQUE,
  role TEXT DEFAULT 'employee' CHECK (role IN ('employee', 'admin')),
  full_name TEXT,
  phone_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- CRITICAL FIX: is_admin() SECURITY DEFINER function
-- Bypasses RLS on public.profiles to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- Policy 1: Users can view ONLY their own profile row; verified Admins can view all profiles
DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by owner or admin" ON public.profiles;
CREATE POLICY "Profiles viewable by owner or admin"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_admin());

-- Policy 2: Users can insert their own initial profile record
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy 3: Users can update their own personal details
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- ==============================================================
-- SECURITY HARDENING: TRIGGER TO PREVENT PROFILE FIELD TAMPERING
-- ==============================================================

-- Block non-admins from changing role, employee_id, or personal_email
CREATE OR REPLACE FUNCTION public.protect_user_profile_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Security Violation: You do not have permission to modify user roles.';
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'Security Violation: You cannot alter your registered Employee ID.';
    END IF;
    IF NEW.personal_email IS DISTINCT FROM OLD.personal_email THEN
      RAISE EXCEPTION 'Security Violation: You cannot alter your registered corporate email.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_protect_user_role ON public.profiles;
DROP TRIGGER IF EXISTS trg_protect_user_profile ON public.profiles;
CREATE TRIGGER trg_protect_user_profile
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_profile_fields();

-- Force default role to 'employee' on new profile inserts
CREATE OR REPLACE FUNCTION public.set_default_employee_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM 'employee' THEN
    IF NOT public.is_admin() AND auth.uid() IS NOT NULL THEN
      NEW.role := 'employee';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_set_default_employee_role ON public.profiles;
CREATE TRIGGER trg_set_default_employee_role
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_default_employee_role();

-- ==============================================================
-- 2. Final Cabs Table (Active Approved Fleet)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.final_cabs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cab_number TEXT NOT NULL,
  driver_name TEXT DEFAULT NULL,
  driver_number TEXT NOT NULL,
  route_area TEXT NOT NULL DEFAULT 'SAR 3' CHECK (route_area IN ('SAR 2', 'SAR 3')),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT unique_cab_driver UNIQUE (cab_number, driver_number)
);

DO $$
BEGIN
  ALTER TABLE public.final_cabs ALTER COLUMN driver_name DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'final_cabs' AND column_name = 'route_area'
  ) THEN
    ALTER TABLE public.final_cabs 
      ADD COLUMN route_area TEXT NOT NULL DEFAULT 'SAR 3';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_final_cabs_route_area'
  ) THEN
    ALTER TABLE public.final_cabs 
      ADD CONSTRAINT check_final_cabs_route_area CHECK (route_area IN ('SAR 2', 'SAR 3'));
  END IF;
END $$;

-- Enable RLS for final_cabs
ALTER TABLE public.final_cabs ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view active cabs
DROP POLICY IF EXISTS "Anyone authenticated can view final cabs" ON public.final_cabs;
CREATE POLICY "Anyone authenticated can view final cabs"
  ON public.final_cabs FOR SELECT
  TO authenticated
  USING (true);

-- Only verified admins can insert into active fleet
DROP POLICY IF EXISTS "Only admins can insert final cabs" ON public.final_cabs;
CREATE POLICY "Only admins can insert final cabs"
  ON public.final_cabs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Only verified admins can update active fleet
DROP POLICY IF EXISTS "Only admins can update final cabs" ON public.final_cabs;
CREATE POLICY "Only admins can update final cabs"
  ON public.final_cabs FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Only verified admins can delete from active fleet
DROP POLICY IF EXISTS "Only admins can delete final cabs" ON public.final_cabs;
CREATE POLICY "Only admins can delete final cabs"
  ON public.final_cabs FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Fast Index for 4-digit search & driver numbers
CREATE INDEX IF NOT EXISTS idx_final_cabs_number ON public.final_cabs(cab_number);
CREATE INDEX IF NOT EXISTS idx_final_cabs_route ON public.final_cabs(route_area);

-- ==============================================================
-- 3. Unapproved Cabs Table (Staging for employee requests)
-- ==============================================================
CREATE TABLE IF NOT EXISTS public.unapproved_cabs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cab_number TEXT NOT NULL,
  driver_name TEXT DEFAULT NULL,
  driver_number TEXT NOT NULL,
  old_driver_number TEXT DEFAULT NULL,
  request_type TEXT DEFAULT 'ADD' CHECK (request_type IN ('ADD', 'UPDATE', 'REMOVE')),
  route_area TEXT NOT NULL DEFAULT 'SAR 3' CHECK (route_area IN ('SAR 2', 'SAR 3')),
  notes TEXT DEFAULT NULL,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

DO $$
BEGIN
  ALTER TABLE public.unapproved_cabs ALTER COLUMN driver_name DROP NOT NULL;
  ALTER TABLE public.unapproved_cabs ADD COLUMN IF NOT EXISTS old_driver_number TEXT DEFAULT NULL;
  ALTER TABLE public.unapproved_cabs ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'unapproved_cabs' AND column_name = 'route_area'
  ) THEN
    ALTER TABLE public.unapproved_cabs 
      ADD COLUMN route_area TEXT NOT NULL DEFAULT 'SAR 3';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_unapproved_cabs_route_area'
  ) THEN
    ALTER TABLE public.unapproved_cabs 
      ADD CONSTRAINT check_unapproved_cabs_route_area CHECK (route_area IN ('SAR 2', 'SAR 3'));
  END IF;
END $$;

-- Prevent duplicate pending requests for the same cab, phone, and request type
CREATE UNIQUE INDEX IF NOT EXISTS idx_unapproved_unique_req 
  ON public.unapproved_cabs(cab_number, driver_number, request_type);

-- Enable RLS for unapproved_cabs
ALTER TABLE public.unapproved_cabs ENABLE ROW LEVEL SECURITY;

-- Authenticated employees can submit cab requests strictly matching auth.uid()
DROP POLICY IF EXISTS "Authenticated users can insert cab requests" ON public.unapproved_cabs;
DROP POLICY IF EXISTS "Users can insert cab requests" ON public.unapproved_cabs;
DROP POLICY IF EXISTS "Employees insert requests" ON public.unapproved_cabs;
CREATE POLICY "Users can insert cab requests"
  ON public.unapproved_cabs FOR INSERT
  TO authenticated
  WITH CHECK (requested_by = auth.uid());

-- Submitters and Admins can view pending requests
DROP POLICY IF EXISTS "Admins and submitters can view pending requests" ON public.unapproved_cabs;
CREATE POLICY "Admins and submitters can view pending requests"
  ON public.unapproved_cabs FOR SELECT
  TO authenticated
  USING (requested_by = auth.uid() OR public.is_admin());

-- Only verified admins can delete/approve/reject pending requests
DROP POLICY IF EXISTS "Only admins can delete from unapproved cabs" ON public.unapproved_cabs;
CREATE POLICY "Only admins can delete from unapproved cabs"
  ON public.unapproved_cabs FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ==============================================================
-- 4. HARDENING: removed email lookup, format checks, atomic approve/reject
-- ==============================================================
-- 1) Remove email-lookup function (leaked personal emails; Edge Function handles Employee ID login)
DROP FUNCTION IF EXISTS public.get_email_by_employee_id(TEXT);

-- 2) Database-level format checks (NOT VALID = existing rows are not re-checked)
ALTER TABLE public.final_cabs
  DROP CONSTRAINT IF EXISTS final_cabs_cab_fmt,
  DROP CONSTRAINT IF EXISTS final_cabs_phone_fmt;
ALTER TABLE public.final_cabs
  ADD CONSTRAINT final_cabs_cab_fmt   CHECK (cab_number ~ '^[0-9]{4}$')     NOT VALID,
  ADD CONSTRAINT final_cabs_phone_fmt CHECK (driver_number ~ '^[0-9]{10}$') NOT VALID;

ALTER TABLE public.unapproved_cabs
  DROP CONSTRAINT IF EXISTS unapproved_cab_fmt,
  DROP CONSTRAINT IF EXISTS unapproved_phone_fmt;
ALTER TABLE public.unapproved_cabs
  ADD CONSTRAINT unapproved_cab_fmt   CHECK (cab_number ~ '^[0-9]{4}$')     NOT VALID,
  ADD CONSTRAINT unapproved_phone_fmt CHECK (driver_number ~ '^[0-9]{10}$') NOT VALID;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_emp_fmt;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_emp_fmt CHECK (employee_id IS NULL OR employee_id ~ '^[0-9]{8}$') NOT VALID;

-- 3) Atomic approve: everything succeeds or nothing changes
CREATE OR REPLACE FUNCTION public.approve_cab_requests(p_ids BIGINT[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can approve requests';
  END IF;

  -- REMOVE requests
  DELETE FROM public.final_cabs f
  USING public.unapproved_cabs u
  WHERE u.id = ANY(p_ids) AND u.request_type = 'REMOVE'
    AND f.cab_number = u.cab_number AND f.driver_number = u.driver_number;

  -- UPDATE requests: drop the old (wrong) driver number first
  DELETE FROM public.final_cabs f
  USING public.unapproved_cabs u
  WHERE u.id = ANY(p_ids) AND u.request_type = 'UPDATE'
    AND u.old_driver_number IS NOT NULL AND u.old_driver_number <> u.driver_number
    AND f.cab_number = u.cab_number AND f.driver_number = u.old_driver_number;

  -- ADD / UPDATE requests
  INSERT INTO public.final_cabs (cab_number, driver_name, driver_number, route_area, updated_at)
  SELECT DISTINCT ON (u.cab_number, u.driver_number)
         u.cab_number,
         NULLIF(TRIM(u.driver_name), ''),
         u.driver_number,
         CASE WHEN UPPER(COALESCE(u.route_area, '')) LIKE '%3%' THEN 'SAR 3' ELSE 'SAR 2' END,
         now()
  FROM public.unapproved_cabs u
  WHERE u.id = ANY(p_ids) AND u.request_type <> 'REMOVE'
  ORDER BY u.cab_number, u.driver_number, u.created_at DESC
  ON CONFLICT (cab_number, driver_number) DO UPDATE
    SET driver_name = EXCLUDED.driver_name,
        route_area  = EXCLUDED.route_area,
        updated_at  = EXCLUDED.updated_at;

  WITH d AS (DELETE FROM public.unapproved_cabs WHERE id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count FROM d;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_cab_requests(p_ids BIGINT[])
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count INT;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can reject requests';
  END IF;
  WITH d AS (DELETE FROM public.unapproved_cabs WHERE id = ANY(p_ids) RETURNING 1)
  SELECT count(*) INTO v_count FROM d;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_cab_requests(BIGINT[]), public.reject_cab_requests(BIGINT[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_cab_requests(BIGINT[]), public.reject_cab_requests(BIGINT[])
  TO authenticated;

-- ==============================================================
-- 5. TRIGGER FOR AUTOMATIC PROFILE ROW CREATION (EMAIL CONFIRMATION SAFE)
-- ==============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, personal_email, employee_id, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'employee_id'), ''),
    'employee',
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    personal_email = EXCLUDED.personal_email,
    employee_id = COALESCE(public.profiles.employee_id, EXCLUDED.employee_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================
-- SUPABASE DASHBOARD CONFIGURATION RECOMMENDATIONS:
-- 1. Immediate Direct Sign In (Skip email confirmation links):
--    Go to: Supabase Dashboard -> Authentication -> Providers -> Email
--    Toggle OFF "Confirm email".
-- 2. To promote a user to Fleet Admin (use the UUID from Authentication -> Users, never employee_id):
--    UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
-- ==============================================================
`;
