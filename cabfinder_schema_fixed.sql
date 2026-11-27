-- ==============================================================
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
-- 4. FUNCTION FOR EMPLOYEE ID LOGIN (SECURED)
-- Restrict get_email_by_employee_id to authenticated & service_role
-- ==============================================================
CREATE OR REPLACE FUNCTION public.get_email_by_employee_id(emp_id TEXT)
RETURNS TEXT AS $$
DECLARE
  found_email TEXT;
BEGIN
  SELECT personal_email INTO found_email
  FROM public.profiles
  WHERE employee_id = emp_id
  LIMIT 1;
  RETURN found_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Revoke anon access to prevent unauthenticated scraping of corporate emails
REVOKE EXECUTE ON FUNCTION public.get_email_by_employee_id(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_email_by_employee_id(TEXT) TO authenticated, service_role;

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
-- 2. To promote a user to Fleet Admin:
--    UPDATE public.profiles SET role = 'admin' WHERE personal_email = 'nsivanji555@gmail.com' OR employee_id = '20674612';
-- ==============================================================
