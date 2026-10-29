"use client";

import { useActionState } from "react";

import { signOutAction } from "@/app/auth/actions";

export function SignOutButton() {
  const [errorMessage, action, pending] = useActionState(signOutAction, null);

  return (
    <div>
      <form action={action}>
        <button
          className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#d9e0d8] px-4 text-sm font-semibold text-[#466352] transition hover:border-[#285c49] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          type="submit"
        >
          {pending ? "Logging out..." : "Log out"}
        </button>
      </form>
      {errorMessage ? (
        <p className="mt-2 text-xs text-[#934d42]" role="alert">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
