import { createClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config/supabase';

export const supabase = createClient(SUPABASE.url, SUPABASE.publishableKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});
