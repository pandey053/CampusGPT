import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardHeaderActions } from "@/components/dashboard-header-actions";

type DashboardShellProps = {
  children: ReactNode;
  email: string;
  section: "student" | "admin";
};

export function DashboardShell({
  children,
  email,
  section,
}: DashboardShellProps) {
  return (
    <div
      className={`flex flex-col ${
        section === "student" ? "h-dvh overflow-hidden" : "min-h-screen"
      }`}
    >
      <header className="shrink-0 border-b border-[#e5eae2] bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
          <div className="flex items-center justify-between gap-5">
            <Link
              className="text-base font-semibold tracking-[-0.04em] text-[#1b3028]"
              href="/"
            >
              Campus<span className="text-[#477963]">GPT</span>
            </Link>
            <span className="rounded-full bg-[#eef4ed] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#477963]">
              {section === "admin" ? "Admin workspace" : "Student workspace"}
            </span>
          </div>
          <DashboardHeaderActions
            email={email}
            showMobileMenu={section === "admin"}
          />
        </div>
      </header>
      <main
        className={`${
          section === "student"
            ? "flex min-h-0 w-full flex-1 flex-col px-2 py-2 sm:px-3 sm:py-3"
            : "mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8 sm:py-14 lg:px-12"
        }`}
      >
        {children}
      </main>
      <footer className="shrink-0 border-t border-[#e5eae2] px-5 py-3 text-center text-xs text-[#7b857d]">
        CampusGPT
      </footer>
    </div>
  );
}
