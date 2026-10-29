import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "CampusGPT — Campus answers, without the scavenger hunt",
  description:
    "CampusGPT is an early-stage project exploring how college handbooks, calendars, and campus resources can be easier to find and understand.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <Script
          id="campusgpt-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("campusgpt-theme");var d=t==="dark";document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch{}',
          }}
        />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
