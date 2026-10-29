import Link from "next/link";

type AuthStatusProps = {
  title: string;
  message: string;
};

export function AuthStatus({ title, message }: AuthStatusProps) {
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <section
        aria-labelledby="auth-status-title"
        className="w-full max-w-lg rounded-3xl border border-[#e3e9e1] bg-white p-7 shadow-sm sm:p-9"
      >
        <Link
          className="text-sm font-semibold text-[#477963] hover:text-[#285c49]"
          href="/"
        >
          CampusGPT
        </Link>
        <h1
          className="mt-7 text-2xl font-semibold tracking-[-0.04em] text-[#25382d]"
          id="auth-status-title"
        >
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#68746c]">{message}</p>
        <Link
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#285c49] px-5 text-sm font-semibold text-white transition hover:bg-[#214c3d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#285c49]"
          href="/login"
        >
          Go to login
        </Link>
      </section>
    </main>
  );
}
