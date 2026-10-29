"use client";

import { useEffect } from "react";
import Link from "next/link";

type RouteErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    console.error("CampusGPT route failed:", error);
  }, [error]);

  return (
    <main className="flex min-h-[65vh] flex-1 items-center justify-center px-5 py-12">
      <section
        aria-labelledby="route-error-title"
        className="w-full max-w-lg rounded-3xl border border-[#e3e9e1] bg-white p-7 shadow-sm sm:p-9"
        role="alert"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b5b4e]">
          Something went wrong
        </p>
        <h1
          className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-[#25382d]"
          id="route-error-title"
        >
          This page could not be loaded
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#68746c]">
          Please try again. If the problem continues, check your Supabase
          project configuration and database migrations.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#285c49] px-5 text-sm font-semibold text-white transition hover:bg-[#214c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
            onClick={reset}
            type="button"
          >
            Try again
          </button>
          <Link
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#d9e0d8] px-5 text-sm font-semibold text-[#466352] transition hover:border-[#285c49] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
            href="/"
          >
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
