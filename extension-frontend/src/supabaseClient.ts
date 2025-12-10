import { createClient } from '@supabase/supabase-js';

// --- DEBUGGING ---
// Let's print the variables to the console to see what Vite is providing.
console.log('VITE_SUPABASE_URL from import.meta.env:', import.meta.env.VITE_SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY from import.meta.env:', import.meta.env.VITE_SUPABASE_ANON_KEY);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL or Anon Key is missing from environment variables. Make sure your extension-frontend/.env file is correct and you have rebuilt the extension.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);