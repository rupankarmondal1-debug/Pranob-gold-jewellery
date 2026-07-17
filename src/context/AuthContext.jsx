import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { supabase, setAuthStorageMode } from "../lib/supabase";

const AuthContext = createContext(null);
const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // auto sign-out after 15 idle minutes

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined); // undefined = not checked yet, null = signed out
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const inactivityTimer = useRef(null);

  const loadProfile = useCallback(async (userId) => {
    setLoadingProfile(true);
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setLoadingProfile(false);
    if (error) {
      setProfile(null);
      return null;
    }
    setProfile(data);
    return data;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      setSession(newSession);
      if (newSession) {
        await loadProfile(newSession.user.id);
        if (event === "SIGNED_IN") await logActivity("login", {});
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  // --- Inactivity auto-logout ------------------------------------
  useEffect(() => {
    if (!session) return;
    const resetTimer = () => {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(async () => {
        await logActivity("auto_logout_inactivity", {});
        await signOut();
      }, INACTIVITY_LIMIT_MS);
    };
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      clearTimeout(inactivityTimer.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function logActivity(action, details) {
    try {
      await supabase.from("activity_logs").insert({
        actor_id: session?.user?.id ?? null,
        actor_email: session?.user?.email ?? null,
        action,
        details,
      });
    } catch (_) {
      /* never block the UI on logging failures */
    }
  }

  async function signIn({ email, password, remember }) {
    setAuthStorageMode(remember); // must run before signInWithPassword
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: friendlyAuthError(error) };
    const prof = await loadProfile(data.user.id);
    if (prof && prof.status === "disabled") {
      await supabase.auth.signOut();
      return { error: "This account has been disabled. Contact your admin." };
    }
    return { data };
  }

  async function signOut() {
    await logActivity("logout", {});
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }

  async function sendPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: friendlyAuthError(error) };
    return { ok: true };
  }

  async function updateMyPassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { error: friendlyAuthError(error) };
    if (profile?.must_change_password) {
      await supabase.from("profiles").update({ must_change_password: false }).eq("id", session.user.id);
      setProfile((p) => ({ ...p, must_change_password: false }));
    }
    await logActivity("password_changed", {});
    return { ok: true };
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loadingProfile,
    isAuthenticated: !!session,
    role: profile?.role ?? null,
    isAdmin: profile?.role === "admin",
    isDisabled: profile?.status === "disabled",
    mustChangePassword: !!profile?.must_change_password,
    signIn,
    signOut,
    sendPasswordReset,
    updateMyPassword,
    logActivity,
    refreshProfile: () => session && loadProfile(session.user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function friendlyAuthError(error) {
  const msg = error?.message || String(error);
  if (/invalid login credentials/i.test(msg)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(msg)) return "Please confirm your email before logging in.";
  if (/rate limit/i.test(msg)) return "Too many attempts. Please wait a bit and try again.";
  if (/user already registered/i.test(msg)) return "An account with this email already exists.";
  return msg;
}
