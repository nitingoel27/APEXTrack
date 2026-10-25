"use client";

import { useEffect, useState } from "react";
import { LogIn, LogOut, ShieldCheck, UserRound, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseClient } from "@/lib/supabaseClient";

type AuthMode = "signIn" | "createAccount";

export default function AccountMenu() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("createAccount");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};

    try {
      const supabase = getSupabaseClient();
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        if (active) {
          setSession(nextSession);
          setIsLoading(false);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();

      void supabase.auth.getSession().then(({ data: sessionData, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          setIsLoading(false);
          return;
        }
        setSession(sessionData.session);
        setIsLoading(false);
      }).catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Unable to check your account.");
        setIsLoading(false);
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to initialize account sign-in.");
      setIsLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const isAnonymous = session?.user.is_anonymous === true;

  function openAccountDialog() {
    setMode(isAnonymous ? "createAccount" : "signIn");
    setMessage(null);
    setError(null);
    setPassword("");
    setIsOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseClient();
      if (mode === "createAccount" && isAnonymous) {
        const { error: upgradeError } = await supabase.auth.updateUser(
          { email: email.trim(), password },
          { emailRedirectTo: `${window.location.origin}/dashboard` },
        );
        if (upgradeError) throw upgradeError;
        setMessage("Check your inbox to confirm your email and finish securing this account. Your guest data stays with this account.");
      } else if (mode === "createAccount") {
        const { error: createError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (createError) throw createError;
        setMessage("Account created. Check your inbox if email confirmation is enabled for your Supabase project.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        window.location.reload();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to complete this account action.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    setError(null);
    setIsSubmitting(true);
    try {
      const { error: signOutError } = await getSupabaseClient().auth.signOut();
      if (signOutError) throw signOutError;
      setIsOpen(false);
      window.location.reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to sign out.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openAccountDialog}
        disabled={isLoading}
        className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm text-slate-300 transition hover:border-indigo-400/30 hover:bg-slate-800 hover:text-white disabled:opacity-50"
      >
        {isAnonymous ? <UserRound size={15} /> : <ShieldCheck size={15} className="text-emerald-300" />}
        <span className="hidden sm:inline">{isLoading ? "Account..." : isAnonymous ? "Save progress" : session?.user.email ?? "Account"}</span>
        <span className="sm:hidden">{isAnonymous ? "Sign in" : "Account"}</span>
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-title"
            className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-2xl"
          >
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Your account</p>
                <h2 id="account-title" className="mt-2 text-xl font-semibold text-white">
                  {isAnonymous ? "Keep your progress" : "Account settings"}
                </h2>
                {isAnonymous && <p className="mt-1 text-sm text-slate-400">Create a password to access your logs on other devices.</p>}
              </div>
              <button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50" aria-label="Close account dialog">
                <X size={18} />
              </button>
            </div>

            {session && !isAnonymous && (
              <div className="mb-5 rounded-xl border border-line bg-slate-950/50 px-4 py-3">
                <p className="text-xs text-slate-500">Signed in as</p>
                <p className="mt-1 break-all text-sm text-slate-200">{session.user.email}</p>
              </div>
            )}

            {message ? (
              <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm leading-6 text-emerald-200">{message}</div>
            ) : (
              <>
                <div className="mb-5 grid grid-cols-2 rounded-xl border border-line bg-slate-950/60 p-1">
                  <button type="button" onClick={() => { setMode("createAccount"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === "createAccount" ? "bg-indigo-500/20 text-indigo-200" : "text-slate-400 hover:text-white"}`}>Create account</button>
                  <button type="button" onClick={() => { setMode("signIn"); setError(null); }} className={`rounded-lg px-3 py-2 text-sm font-medium transition ${mode === "signIn" ? "bg-indigo-500/20 text-indigo-200" : "text-slate-400 hover:text-white"}`}>Sign in</button>
                </div>
                <form onSubmit={(event) => void submit(event)} className="space-y-4">
                  <div>
                    <label htmlFor="account-email" className="mb-1.5 block text-sm font-medium text-slate-300">Email</label>
                    <input id="account-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-line bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400" placeholder="you@example.com" />
                  </div>
                  <div>
                    <label htmlFor="account-password" className="mb-1.5 block text-sm font-medium text-slate-300">Password</label>
                    <input id="account-password" type="password" autoComplete={mode === "signIn" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-line bg-slate-950/70 px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400" placeholder="At least 6 characters" />
                  </div>
                  {error && <p role="alert" className="text-sm leading-5 text-rose-300">{error}</p>}
                  <button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:cursor-wait disabled:opacity-60">
                    {mode === "signIn" ? <LogIn size={16} /> : <ShieldCheck size={16} />}
                    {isSubmitting ? "Please wait..." : mode === "signIn" ? "Sign in" : isAnonymous ? "Save guest progress" : "Create account"}
                  </button>
                </form>
                {isAnonymous && mode === "signIn" && <p className="mt-4 text-xs leading-5 text-amber-200/80">Signing in switches to that account. Guest data will not appear in the account you sign into; use “Create account” first to keep this guest profile’s data.</p>}
              </>
            )}

            {session && !isAnonymous && (
              <button type="button" onClick={() => void signOut()} disabled={isSubmitting} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:border-rose-400/30 hover:text-rose-200 disabled:opacity-50">
                <LogOut size={16} /> {isSubmitting ? "Signing out..." : "Sign out"}
              </button>
            )}
          </section>
        </div>
      )}
    </>
  );
}
