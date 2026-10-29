import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";

import { AuthStatus } from "@/components/auth-status";
import { DashboardShell } from "@/components/dashboard-shell";
import { DocumentManagement } from "@/components/document-management";
import { AdminAnalyticsPanel } from "@/components/admin-analytics";
import { getViewerContext } from "@/lib/auth";
import { loadAdminAnalytics } from "@/lib/admin-analytics-server";

export const maxDuration = 120;

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardFallback />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function AdminDashboardFallback() {
  return (
    <main
      aria-label="Loading admin workspace"
      aria-live="polite"
      className="mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
    >
      <div className="animate-pulse">
        <div className="h-3 w-32 rounded bg-[#e5eae2]" />
        <div className="mt-5 h-10 w-72 max-w-full rounded bg-[#e5eae2]" />
        <div className="mt-4 h-4 w-full max-w-xl rounded bg-[#e5eae2]" />
        <div className="mt-10 h-64 rounded-3xl border border-[#e3e9e1] bg-white" />
      </div>
      <span className="sr-only">Loading the admin workspace...</span>
    </main>
  );
}

async function AdminDashboardContent() {
  await connection();
  const viewer = await getViewerContext();

  if (viewer.status === "not-configured") {
    return (
      <AuthStatus
        message="Add your Supabase project URL and publishable key to the local environment, then restart the app."
        title="Connect Supabase to continue"
      />
    );
  }

  if (viewer.status === "error") {
    return (
      <AuthStatus
        message="We could not verify your account or load its profile. Please try again."
        title="The admin workspace could not be loaded"
      />
    );
  }

  if (viewer.status === "profile-unavailable") {
    return (
      <AuthStatus
        message="The profiles table is missing from the Supabase schema or its schema cache is stale. Review and apply supabase/migrations/20261027010000_profiles_repair.sql in the Supabase SQL Editor, then try again."
        title="Your profile table is unavailable"
      />
    );
  }

  if (viewer.status === "unauthenticated") {
    redirect("/login?next=%2Fadmin");
  }

  if (viewer.role !== "admin") {
    redirect("/dashboard");
  }

  const { data: documents, error } = await viewer.supabase
    .from("documents")
    .select(
      "id, title, description, storage_path, mime_type, uploaded_by, metadata, created_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Could not load admin documents:", error);

    return (
      <AuthStatus
        message="Your admin access was verified, but the document list could not be loaded. Check the Supabase migrations and try again."
        title="Documents are unavailable"
      />
    );
  }

  const { analytics, error: analyticsLoadError } =
    await loadAdminAnalytics(viewer);

  return (
    <DashboardShell email={viewer.user.email ?? ""} section="admin">
      <section aria-labelledby="admin-title">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6c8c72]">
          Admin workspace
        </p>
        <h1
          className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-[#25382d] sm:text-4xl"
          id="admin-title"
        >
          Campus resources
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-[#68746c]">
          Upload college PDFs, process their searchable text, and review status
          or retry failed documents.
        </p>
      </section>

      <div className="mt-10">
        <DocumentManagement documents={documents} />
      </div>
      <AdminAnalyticsPanel
        analytics={analytics}
        error={analyticsLoadError}
      />
    </DashboardShell>
  );
}
