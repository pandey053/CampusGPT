"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { createClient } from "@/lib/supabase/client";
import { logSupabaseError } from "@/lib/supabase/diagnostics";

type AuthFormProps = {
  mode: "login" | "signup";
  nextPath: string;
  initialError?: string;
};

export function AuthForm({ mode, nextPath, initialError }: AuthFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    initialError
      ? "Your sign-in link could not be verified. Please try signing in again."
      : null,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const isSignup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    try {
      const supabase = createClient();

      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });

        if (error) {
          logSupabaseError("auth.signUp", error);
          setErrorMessage(error.message);
          return;
        }

        if (!data.session) {
          setSuccessMessage(
            "Check your email for a confirmation link to finish creating your account.",
          );
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          logSupabaseError("auth.signInWithPassword", error);
          setErrorMessage(error.message);
          return;
        }
      }

      router.replace(nextPath);
      router.refresh();
    } catch (error) {
      logSupabaseError(
        isSignup ? "auth.signUp.request" : "auth.signInWithPassword.request",
        error,
      );
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage("We could not complete your request. Please try again.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-12 sm:py-16">
      <section
        aria-labelledby="auth-title"
        className="w-full max-w-md rounded-3xl border border-[#e3e9e1] bg-white p-7 shadow-[0_24px_70px_-46px_rgba(28,54,40,0.35)] sm:p-9"
      >
        <Link
          className="text-sm font-semibold text-[#477963] hover:text-[#285c49]"
          href="/"
        >
          ← CampusGPT home
        </Link>
        <p className="mt-8 text-xs font-semibold uppercase tracking-[0.16em] text-[#6c8c72]">
          Your campus workspace
        </p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#25382d]"
          id="auth-title"
        >
          {isSignup ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#68746c]">
          {isSignup
            ? "Sign up with your email and password to get started."
            : "Log in to continue to your CampusGPT workspace."}
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-[#34443a]"
              htmlFor={`${mode}-email`}
            >
              Email address
            </label>
            <input
              autoComplete="email"
              className="min-h-12 w-full rounded-xl border border-[#dce3db] bg-[#fcfdfb] px-4 text-sm text-[#25382d] outline-none transition placeholder:text-[#97a098] focus:border-[#70947a] focus:ring-2 focus:ring-[#70947a]/20"
              id={`${mode}-email`}
              name="email"
              placeholder="you@college.edu"
              required
              type="email"
            />
          </div>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-[#34443a]"
              htmlFor={`${mode}-password`}
            >
              Password
            </label>
            <input
              autoComplete={isSignup ? "new-password" : "current-password"}
              className="min-h-12 w-full rounded-xl border border-[#dce3db] bg-[#fcfdfb] px-4 text-sm text-[#25382d] outline-none transition placeholder:text-[#97a098] focus:border-[#70947a] focus:ring-2 focus:ring-[#70947a]/20"
              id={`${mode}-password`}
              minLength={8}
              name="password"
              required
              type="password"
            />
            {isSignup ? (
              <p className="mt-2 text-xs leading-5 text-[#7b857d]">
                Use at least 8 characters.
              </p>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              className="rounded-xl border border-[#f0d7d2] bg-[#fff7f5] px-4 py-3 text-sm leading-5 text-[#934d42]"
              role="alert"
            >
              {errorMessage}
            </p>
          ) : null}
          {successMessage ? (
            <p
              className="rounded-xl border border-[#d8e9da] bg-[#f4faf4] px-4 py-3 text-sm leading-5 text-[#3d684f]"
              role="status"
            >
              {successMessage}
            </p>
          ) : null}

          <button
            className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#285c49] px-5 text-sm font-semibold text-white transition hover:bg-[#214c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
            type="submit"
          >
            {pending
              ? isSignup
                ? "Creating account..."
                : "Logging in..."
              : isSignup
                ? "Create account"
                : "Log in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#68746c]">
          {isSignup ? "Already have an account?" : "New to CampusGPT?"}{" "}
          <Link
            className="font-semibold text-[#3d684f] underline-offset-4 hover:underline"
            href={{
              pathname: isSignup ? "/login" : "/signup",
              query: nextPath === "/dashboard" ? undefined : { next: nextPath },
            }}
          >
            {isSignup ? "Log in" : "Create an account"}
          </Link>
        </p>
        <p className="mt-6 border-t border-[#edf0eb] pt-5 text-xs leading-5 text-[#7b857d]">
          Accounts start with the student role. Admin access can only be
          assigned through a trusted server-side process.
        </p>
      </section>
    </main>
  );
}
