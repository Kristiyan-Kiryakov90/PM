/**
 * Supabase Client Singleton
 * Provides a single instance of the Supabase client for the entire application
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

// Create Supabase client singleton
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Auth configuration
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  db: {
    // Database configuration
    schema: 'public',
  },
});

// Add URL and key to client object for edge function calls
supabase.supabaseUrl = supabaseUrl;
supabase.supabaseKey = supabaseAnonKey;

// Export singleton instance
export default supabase;

// Export helper to check connection
export async function checkConnection() {
  try {
    const { data, error } = await supabase.from('companies').select('count');
    if (error) throw error;
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection failed:', error.message);
    return false;
  }
}
