
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../supabase";

// Inner component reads search params — must be inside <Suspense>
function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Pre-select tab from ?tab=signup or ?tab=login; defaults to signup
  const initialTab = searchParams.get("tab") === "login" ? "login" : "signup";

  const [mode, setMode] = useState(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleAuth(event) {
    event.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });

        if (error) throw error;

        if (data.session) {
          setMessage("Account created successfully!");
          router.push("/");
        } else {
          setMessage(
            "Account created! Check your email to confirm your account, then log in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        setMessage("Login successful!");
        router.push("/");
      }
    } catch (error) {
      // Supabase returns error_code="email_not_confirmed" when the user signed up
      // but hasn't clicked the confirmation link yet. Surface a clear message.
      if (error?.code === "email_not_confirmed") {
        setMessage(
          "Your email address is not confirmed yet. " +
          "Please check your inbox (and spam folder) for the confirmation link from Supabase, " +
          "then try logging in again."
        );
      } else {
        setMessage(error.message || "Something went wrong.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <h1 className="text-3xl font-bold text-slate-900">RideEase</h1>

        <p className="mt-2 text-slate-600">
          {mode === "signup"
            ? "Create your account to get started."
            : "Welcome back! Log in to continue."}
        </p>

        {/* Tab switcher */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            id="tab-signup"
            type="button"
            onClick={() => { setMode("signup"); setMessage(""); }}
            className={`rounded-lg border p-3 font-medium ${
              mode === "signup"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
            }`}
          >
            Sign up
          </button>

          <button
            id="tab-login"
            type="button"
            onClick={() => { setMode("login"); setMessage(""); }}
            className={`rounded-lg border p-3 font-medium ${
              mode === "login"
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-700 border-slate-300 hover:border-blue-400"
            }`}
          >
            Log in
          </button>
        </div>

        <form onSubmit={handleAuth} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email address
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              placeholder="At least 6 characters"
              className="w-full rounded-lg border border-slate-300 p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            id="auth-submit"
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 p-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {loading
              ? "Please wait…"
              : mode === "signup"
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        {message && (
          <p
            role="status"
            className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700"
          >
            {message}
          </p>
        )}

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-5 w-full text-sm text-blue-700 hover:underline"
        >
          ← Back to RideEase home
        </button>
      </div>
    </main>
  );
}

// Page export — wraps the form in Suspense (required for useSearchParams in App Router)
export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 flex items-center justify-center">
          <p className="text-slate-500">Loading…</p>
        </main>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
