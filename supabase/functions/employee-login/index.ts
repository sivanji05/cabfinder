// Supabase Edge Function: employee-login
// Securely authenticates an employee using their 8-digit Employee ID and password
// on the server side without exposing personal_email to unauthenticated clients.
//
// Deploy via Supabase CLI:
//   supabase functions deploy employee-login

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { employee_id, password } = await req.json();

    if (!employee_id || !password || typeof employee_id !== 'string' || typeof password !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Invalid Employee ID or password.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmpId = employee_id.trim();
    if (!/^\d{8}$/.test(cleanEmpId)) {
      return new Response(
        JSON.stringify({ error: 'Employee ID must be exactly 8 numeric digits.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const authClient = createClient(supabaseUrl, anonKey);

    // 1. Lookup email using service_role strictly on the server (never returned on failure)
    const { data: profile, error: lookupError } = await adminClient
      .from('profiles')
      .select('*')
      .eq('employee_id', cleanEmpId)
      .maybeSingle();

    if (lookupError || !profile?.personal_email) {
      return new Response(
        JSON.stringify({ error: 'Invalid Employee ID or password.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Verify password via Supabase Auth
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
      email: profile.personal_email,
      password,
    });

    if (authError || !authData.session) {
      return new Response(
        JSON.stringify({ error: 'Invalid Employee ID or password.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Return verified session & user profile
    return new Response(
      JSON.stringify({
        session: authData.session,
        profile: {
          id: profile.id,
          personal_email: profile.personal_email,
          employee_id: profile.employee_id,
          role: profile.role === 'admin' ? 'admin' : 'employee',
          full_name: profile.full_name,
          phone_number: profile.phone_number,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ error: 'Unable to process login request.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
