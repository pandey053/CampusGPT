"use client";

import { useEffect, useRef, useState } from "react";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export function DashboardHeaderActions({
  email,
  showMobileMenu = true,
}: {
  email: string;
  showMobileMenu?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menuRef.current?.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }

    function handleResize() {
      if (window.innerWidth >= 768) setMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleResize);
    };
  }, [menuOpen]);

  return (
    <div className="flex items-center justify-between gap-3 sm:justify-end">
      <p className="max-w-[220px] truncate text-xs text-[#737e75] sm:text-sm">
        {email}
      </p>
      <div className="hidden items-center gap-3 md:flex">
        <ThemeToggle />
        <SignOutButton />
      </div>
      {showMobileMenu ? (
        <div className="relative md:hidden" ref={menuRef}>
          <button
            aria-controls="dashboard-header-actions-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="icon-button h-10 w-10 border border-[#dce3db] bg-white"
            onClick={() => setMenuOpen((open) => !open)}
            ref={triggerRef}
            type="button"
          >
            <MenuIcon />
          </button>
          {menuOpen ? (
            <div
              aria-label="Dashboard actions"
              className="chat-menu-popover absolute right-0 top-full z-50 mt-2 flex w-[min(16rem,calc(100vw-2rem))] flex-col items-start gap-2 rounded-xl border border-[#e3e9e1] bg-white p-3 shadow-lg"
              id="dashboard-header-actions-menu"
              onSubmitCapture={() => setMenuOpen(false)}
              role="group"
            >
              <ThemeToggle onToggle={() => setMenuOpen(false)} />
              <SignOutButton />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
    >
      <path
        d="M4 6h16M4 12h16M4 18h16"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}
