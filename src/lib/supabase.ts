import { createClient } from '@supabase/supabase-js';

const DEFAULT_URL = 'https://wlccughbhcqgwfgspjok.supabase.co';
const DEFAULT_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndsY2N1Z2hiaGNxZ3dmZ3Nwam9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyMjU5MjEsImV4cCI6MjEwODgwMTkyMX0.hxwq0pxILbGzr2ce8nN9XOlfIJTAQQVvd98tWAq3CV8';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

const supabaseUrl = rawUrl.startsWith('https://') ? rawUrl : DEFAULT_URL;
const supabaseAnonKey = rawKey.startsWith('eyJ') ? rawKey : DEFAULT_KEY;

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
