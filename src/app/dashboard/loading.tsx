export default function StudentDashboardLoading() {
  return (
    <main
      aria-label="Loading student workspace"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
    >
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-[#e5eae2]" />
        <div className="mt-5 h-10 w-72 max-w-full rounded bg-[#e5eae2]" />
        <div className="mt-4 h-4 w-full max-w-xl rounded bg-[#e5eae2]" />
        <div className="mt-10 h-48 rounded-3xl border border-[#e3e9e1] bg-white" />
      </div>
      <span className="sr-only">Loading your workspace...</span>
    </main>
  );
}
