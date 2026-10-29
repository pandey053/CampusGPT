import { Suspense } from "react";

import { AuthForm } from "@/components/auth-form";
import { AuthFormLoading } from "@/components/auth-form-loading";
import { getSafeRedirectPath } from "@/lib/auth-path";

type SignupPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default function SignupPage({ searchParams }: SignupPageProps) {
  return (
    <Suspense fallback={<AuthFormLoading />}>
      <SignupPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SignupPageContent({ searchParams }: SignupPageProps) {
  const params = await searchParams;

  return (
    <AuthForm mode="signup" nextPath={getSafeRedirectPath(params.next)} />
  );
}
