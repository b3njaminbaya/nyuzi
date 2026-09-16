import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { clearStoredReferralCode, getStoredReferralCode } from "@/lib/referral";

type Profile = {
  id: string;
  full_name: string | null;
  role: "donor" | "buyer" | "partner" | "admin";
  referral_code: string;
  credit_balance: number;
};

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // A single request counter guards two races at once: (1) `loading` must
    // not clear until the profile fetch for the current session has also
    // resolved, or admin/role-gated UI briefly renders as if signed out
    // (AdminLayout would flash "Not authorized" for a real admin on every
    // hard refresh); (2) if the session changes again before an in-flight
    // profile fetch resolves (e.g. sign out immediately followed by signing
    // in as someone else in the same tab), the stale response must not be
    // allowed to overwrite the newer one.
    let requestId = 0;

    const applySession = async (newSession: Session | null) => {
      const thisRequest = ++requestId;
      setSession(newSession);

      const userId = newSession?.user?.id;
      if (!userId) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role, referral_code, credit_balance")
        .eq("id", userId)
        .single();

      if (thisRequest === requestId) {
        setProfile(data as Profile | null);
      }
    };

    supabase.auth.getSession().then(async ({ data }) => {
      await applySession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      applySession(newSession);
    });

    return () => {
      requestId += 1;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signUp: AuthContextValue["signUp"] = async (email, password, fullName) => {
    const referralCode = getStoredReferralCode();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, referral_code: referralCode } },
    });
    if (!error && referralCode) {
      clearStoredReferralCode();
    }
    return { error: error?.message ?? null };
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const requestPasswordReset: AuthContextValue["requestPasswordReset"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const updatePassword: AuthContextValue["updatePassword"] = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return { error: error?.message ?? null };
  };

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        profile,
        isAdmin: profile?.role === "admin",
        loading,
        signUp,
        signIn,
        signOut,
        requestPasswordReset,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
