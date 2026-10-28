import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://wlccughbhcqgwfgspjok.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsY2N1Z2hiaGNxZ3dmZ3Nwam9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjU5MjEsImV4cCI6MjEwODgwMTkyMX0.hxwq0pxILbGzr2ce8nN9XOlfIJTAQQVvd98tWAq3CV8';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
