import { createClient } from "@supabase/supabase-js";

// Hardcoded fallback values so this runs in environments without a .env
// file (e.g. Claude Preview). If VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
// ARE set (via .env or your host's env var settings), those take priority —
// this lets the same code run locally, in Preview, and in production.
//
// Note: the anon key is safe to ship in client code by design. Supabase's
// real security boundary is Row Level Security (sql/rls.sql), not keeping
// this key secret. Still, prefer env vars for anything beyond a quick
// preview so you can point different environments at different projects.
const FALLBACK_SUPABASE_URL = "https://hliwyqasqmrktblyjcza.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsaXd5cWFzcW1ya3RibHlqY3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2ODM2NjQsImV4cCI6MjA5OTI1OTY2NH0.Km1LcbiWYveLkfPUSG3CXsKpoa57m0LH_ADWpf--9TM";

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || FALLBACK_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;

// --- Custom storage adapter for "Remember Me" -----------------------
// Supabase's client only reads the `storage` option once, at creation
// time — but we don't know the user's "Remember Me" choice until they
// submit the login form. This adapter solves that by checking a small
// mode flag (itself always in localStorage, since it has to survive
// page reloads) every time the session is read/written, and delegating
// to either localStorage (remembered) or sessionStorage (forgotten when
// the tab closes). Login.jsx sets the flag via setAuthStorageMode()
// before calling signInWithPassword().
const AUTH_MODE_KEY = "pgj-auth-storage-mode"; // 'local' | 'session'
export function setAuthStorageMode(remember) {
  localStorage.setItem(AUTH_MODE_KEY, remember ? "local" : "session");
}
function activeStorage() {
  const mode = localStorage.getItem(AUTH_MODE_KEY) || "local";
  return mode === "session" ? sessionStorage : localStorage;
}
const rememberAwareStorage = {
  getItem: (key) => activeStorage().getItem(key),
  setItem: (key, value) => activeStorage().setItem(key, value),
  removeItem: (key) => activeStorage().removeItem(key),
};

// The anon key is safe to ship to the browser by design — Supabase's
// actual security boundary is Row Level Security (see sql/03_rls_policies.sql),
// not keeping this key secret.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // needed for the Forgot Password reset link
    storage: rememberAwareStorage,
  },
});
