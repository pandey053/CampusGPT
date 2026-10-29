export function AuthFormLoading() {
  return (
    <main
      aria-label="Loading account form"
      aria-live="polite"
      className="flex flex-1 items-center justify-center px-5 py-12 sm:py-16"
    >
      <div className="w-full max-w-md animate-pulse rounded-3xl border border-[#e3e9e1] bg-white p-7 sm:p-9">
        <div className="h-4 w-32 rounded bg-[#e5eae2]" />
        <div className="mt-10 h-8 w-56 rounded bg-[#e5eae2]" />
        <div className="mt-8 h-12 rounded-xl bg-[#f0f3ee]" />
        <div className="mt-5 h-12 rounded-xl bg-[#f0f3ee]" />
        <div className="mt-6 h-12 rounded-full bg-[#dce7dc]" />
        <span className="sr-only">Loading account form...</span>
      </div>
    </main>
  );
}
