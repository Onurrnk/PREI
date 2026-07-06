// =====================================================================
// PREI | Supabase client (yalnız Auth — gerçek login modu)
// anon key public'tir (tarayıcıya açık olacak şekilde tasarlı). Gerçek yetki
// backend + RLS'te. Portable: VPS'e geçince VITE_SUPABASE_URL host'u değişir.
// =====================================================================
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://kkcvfvbjmohlplepadip.supabase.co';
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrY3ZmdmJqbW9obHBsZXBhZGlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA0Mzg4MzAsImV4cCI6MjA3NjAxNDgzMH0.BOumujY5hsEgDJ5K4DwTjdOGAwJuqAZltsby0_gJUv8';

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});
