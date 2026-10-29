import { Suspense } from "react";

import { AuthForm } from "@/components/auth-form";
import { AuthFormLoading } from "@/components/auth-form-loading";
import { getSafeRedirectPath } from "@/lib/auth-path";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <Suspense fallback={<AuthFormLoading />}>
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginPageContent({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthForm
      initialError={typeof params.error === "string" ? params.error : undefined}
      mode="login"
      nextPath={getSafeRedirectPath(params.next)}
    />
  );
}
