import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeRedirectPath } from "@/lib/auth-path";
import { logSupabaseError } from "@/lib/supabase/diagnostics";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/database.types";

export async function GET(request: NextRequest) {
  const config = getSupabasePublicConfig();
  const code = request.nextUrl.searchParams.get("code");
  const callbackError = request.nextUrl.searchParams.get("error");
  const nextPath = getSafeRedirectPath(
    request.nextUrl.searchParams.get("next") ?? undefined,
  );

  if (!config || !code || callbackError) {
    return redirectWithCookies(
      new URL("/login?error=confirmation", request.url),
      [],
      {},
    );
  }

  let cookiesToSet: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];
  let cacheHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookies, headers) {
          cookies.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          cookiesToSet = cookies;
          cacheHeaders = headers;
        },
      },
    },
  );

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      logSupabaseError("auth.exchangeCodeForSession", error);
      return redirectWithCookies(
        new URL("/login?error=confirmation", request.url),
        cookiesToSet,
        cacheHeaders,
      );
    }
  } catch (error) {
    logSupabaseError("auth.exchangeCodeForSession.request", error);
    return redirectWithCookies(
      new URL("/login?error=confirmation", request.url),
      cookiesToSet,
      cacheHeaders,
    );
  }

  return redirectWithCookies(
    new URL(nextPath, request.url),
    cookiesToSet,
    cacheHeaders,
  );
}

function redirectWithCookies(
  url: URL,
  cookiesToSet: {
    name: string;
    value: string;
    options: CookieOptions;
  }[],
  cacheHeaders: Record<string, string>,
) {
  const response = NextResponse.redirect(url);

  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });

  Object.entries(cacheHeaders).forEach(([name, value]) => {
    response.headers.set(name, value);
  });

  return response;
}
