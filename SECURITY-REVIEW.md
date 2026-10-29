# CampusGPT Pre-Deployment Audit

**Scope:** Read-only code, migration, test, and configuration review. No database
queries, migrations, deployment actions, or secret files were accessed.

## Executive summary

The application has broad feature coverage and local checks pass, but it is not
ready for deployment until the chat persistence RPC's trust boundary and the
Vercel PDF-upload path are addressed and live Supabase configuration is
verified. No live Supabase, Gemini, Vercel, or browser verification was
performed.

## Security finding

### Medium — authenticated clients can forge persisted chat exchanges

`save_chat_exchange` is a `SECURITY DEFINER` function executable by the
`authenticated` role. It checks that the chat belongs to the caller but does
not verify a student role or that the answer/evidence flag came from trusted
server-side Gemini/RAG logic. A client can call the RPC directly and persist
arbitrary assistant text and evidence status in its own chat, bypassing the
server action's role check and polluting administrator analytics. The older
four-argument overload from the Phase 3 migration remains granted as well as
the newer five-argument signature.

Evidence:
- [`20261027170000_phase3_rag.sql`](./supabase/migrations/20261027170000_phase3_rag.sql),
  `save_chat_exchange(uuid,text,text,jsonb)`, lines 47–111.
- [`20261029050000_feedback_admin_analytics.sql`](./supabase/migrations/20261029050000_feedback_admin_analytics.sql),
  `save_chat_exchange(uuid,text,text,jsonb,boolean)`, lines 74–140.
- [`chat-actions.ts`](./src/app/dashboard/chat-actions.ts), role gate and
  application RPC call, lines 209–220 and 356–364.

The caller's own-chat ownership check limits cross-user access, but does not
prevent forged records or inaccurate global analytics.

## Readiness findings

- **PDF upload on Vercel:** the app accepts files up to 20 MiB and sets a
  21 MiB Server Action body limit. This exceeds the commonly documented
  serverless function request-body allowance; verify the current Vercel limit
  before relying on uploads above that size. Large-file upload was not tested
  on Vercel.
- **Rate limiting:** chat and processing throttles use a process-local
  `Map`, so limits are best-effort and do not coordinate across serverless
  instances or cold starts.
- **Migration state:** migrations are applied manually; no live schema was
  queried. Apply and verify all required migrations in timestamp order. Prior
  local runtime evidence recorded `42703: column feedback.sentiment does not
  exist`, so feedback/admin analytics were not confirmed against the live
  database.
- **Chat history:** the dashboard loads at most 50 messages for a selected
  conversation; older messages are not paginated into the view.
- **PDF coverage:** scanned/image-only PDFs are unsupported because OCR is not
  configured. Processing is synchronous and has no automatic retry.
- **Privacy/logging:** development RAG diagnostics log document titles and up
  to 140 characters of retrieved text. Keep development logs access-controlled
  and avoid enabling equivalent content logging in production.
- **Repository status:** the workspace has a `.gitignore` rule excluding
  `.env*` except `.env.example`, but this directory is not a Git repository,
  so tracked-file/commit history and committed-secret status could not be
  checked.

## Verification performed

- `npm.cmd test` — passed, 29 tests across 8 files.
- `npx.cmd tsc --noEmit` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed.
- `npm.cmd audit --offline` — reported zero vulnerabilities from the local
  advisory cache; this is not a live registry check.

Unit tests do not provide live PostgreSQL/RLS, storage, Gemini, browser, or
end-to-end coverage. Those require separate pre-release verification.

## Deployment recommendation

**NOT READY — FIX BLOCKERS FIRST.** Resolve the RPC trust-boundary issue,
confirm the Vercel upload limit or use an appropriate upload flow, and verify
the Supabase migration/RLS state before release.
