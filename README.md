# CampusGPT

CampusGPT is a Next.js 16 App Router project using TypeScript, Tailwind CSS v4,
Supabase Auth/PostgreSQL/Storage/pgvector, and the Gemini API. It provides
email/password authentication, protected student and admin workspaces,
private college PDF management, document indexing, and grounded answers with
source citations.

## Local setup

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local` and add the project URL and publishable
   key from the Supabase project's API settings:

   ```dotenv
   NEXT_PUBLIC_SUPABASE_URL=
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
   GEMINI_API_KEY=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

   Keep the values supplied by your own project. The publishable key is intended
   for browser use and is protected by database grants and RLS. Never put a
   `service_role` key in a `NEXT_PUBLIC_` variable or browser code.
   `GEMINI_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are server-only: never
   prefix them with `NEXT_PUBLIC_`, import them in client code, or expose them
   in browser requests. The service-role key is used only by the authenticated
   server action to persist chat exchanges through a narrowly granted RPC.

3. In Supabase Authentication settings, enable the Email provider and configure
   the site URL and redirect allowlist to include
   `http://localhost:3000/auth/callback`. Add your real production callback URL
   when deploying. Supabase's email confirmation setting controls whether new
   users must confirm their address before they can log in.
4. Review the SQL migrations under [`supabase/migrations`](./supabase/migrations).
   For a new project, apply them in timestamp order. For an existing project
   where `public.profiles` is missing, apply
   [`20261027010000_profiles_repair.sql`](./supabase/migrations/20261027010000_profiles_repair.sql)
   through the Supabase Dashboard SQL Editor or your reviewed Supabase CLI
   workflow. The repair migration preserves existing profile roles and inserts
   student profiles only for Auth users who do not already have one. This
   repository does not run remote migrations automatically.
   For an existing Phase 1 database, review and manually apply
   [`20261027170000_phase3_rag.sql`](./supabase/migrations/20261027170000_phase3_rag.sql)
   in the Supabase SQL Editor. It adds citation storage and narrowly scoped
   authenticated RPCs for semantic retrieval and saving chat exchanges. It does
   not drop or recreate existing tables or policies; the secure chat exchange
   migration below replaces the initial client-executable persistence RPC.
   If Phase 3 was already applied before the pgvector operator fix, also review
   and manually apply
   [`20261027180000_phase3_match_operator.sql`](./supabase/migrations/20261027180000_phase3_match_operator.sql).
   It updates only the existing semantic-search function to qualify the
   pgvector cosine-distance operator in the `extensions` schema.
   Apply
   [`20261029060000_secure_chat_exchange.sql`](./supabase/migrations/20261029060000_secure_chat_exchange.sql)
   to restrict chat persistence to the server-side service-role client. It
   removes the unused four-argument overload and replaces the five-argument
   RPC with a six-argument version that verifies student role and chat
   ownership. It does not modify existing chat rows. After applying it, run
   [`save_chat_exchange_permissions.sql`](./supabase/tests/save_chat_exchange_permissions.sql)
   in the SQL Editor to verify the deployed function grants and retired
   overloads. New evidence status is stored on the assistant response and
   linked to its user question; legacy user-message evidence values remain
   untouched and are still included in unanswered-question analytics.
5. Install and start the app:

   ```powershell
   npm.cmd install
   npm.cmd run dev
   ```

   Open `http://localhost:3000`.

## Auth and authorization

- The browser and server use separate `@supabase/ssr` clients. `src/proxy.ts`
  refreshes cookie-backed sessions using verified Supabase claims, following
  the Next.js 16 Proxy convention.
- Student and admin pages validate the current user on the server and read the
  role from `profiles`. Admin access is never granted based on client-side
  state, user metadata, or hidden controls.
- The database trigger creates each new profile with the `student` role.
  Authenticated users have no profile insert/update grants. Role assignment is
  available only to the trusted `service_role` database role through the
  restricted `set_profile_role` function; never expose service-role credentials
  to a browser.
- To promote an account manually, first sign up that user and confirm their
  account. Then, as a trusted project owner in the Supabase Dashboard SQL
  Editor, find their UUID in Authentication > Users and run:

  ```sql
  select public.set_profile_role('AUTH_USER_UUID'::uuid, 'admin');
  ```

- RLS scopes chats, messages, and feedback to the owning user. Document and
  chunk writes require an admin profile. `save_chat_exchange` checks chat
  ownership before atomically inserting the user's question and the assistant
  answer; it does not grant general permission to insert assistant messages.

## Document processing and RAG

- After uploading a PDF in the admin workspace, select **Process PDF**. This is
  an explicit synchronous action; no background-job service is configured.
  Failed processing can be retried from the document list.
- Processing downloads from the private `college-documents` bucket with the
  authenticated server-side Supabase client, extracts selectable text with
  PDF.js, splits it into overlapping page-aware chunks, and replaces the
  document's previous chunks only after embeddings have been generated.
- The current limits are 20 MiB per PDF, 50 pages, 60 chunks, and a 20-second
  timeout per Gemini request. Requests are not automatically retried after
  timeouts. Image-only/scanned PDFs fail with an explicit
  OCR-not-configured status; they are not marked processed.
- The existing `documents.metadata` stores processing status, errors, counts,
  and timestamps. Chunk metadata stores the source page number.
- Embeddings use Google's current model `gemini-embedding-2` with
  `output_dimensionality: 768`, matching `chunks.embedding vector(768)`.
  Google's guide recommends 768, 1536, or 3072 output dimensions for this
  model and specifies task prefixes for text retrieval:
  <https://ai.google.dev/gemini-api/docs/embeddings>. Answer generation uses
  the synchronous Gemini `generateContent` API with `gemini-3.6-flash`, which
  Google documents as remaining supported and optimized for higher speed and
  lower cost. The request uses low thinking effort; all Gemini requests run
  on the server. See Google's
  <https://ai.google.dev/gemini-api/docs/models/gemini-3.6-flash> and
  <https://ai.google.dev/gemini-api/docs/generate-content/text-generation>.
- Questions retrieve at most five processed chunks above cosine similarity
  0.45. In development, retrieval diagnostics include document titles,
  similarity scores, previews limited to 140 characters, and flags for the
  skills/resume-event markers. Gemini receives the full retrieved chunks (up to
  five), while citations retain compact excerpts. It is instructed
  to use that context exclusively, and may cite only IDs from the retrieved
  results. Citations are validated against those results before being saved.
  When no chunks meet the retrieval threshold, the app returns a fixed
  not-found answer without asking Gemini to invent one.
- Chats and messages use the existing owner-scoped RLS. The Phase 3 migration
  adds a JSONB citations column and the constrained RPC described above.
- Question and processing limits are in-memory per server process. This is
  best-effort protection for development/small deployments; use a shared,
  durable rate-limit store before scaling across multiple server instances.
- The initial schema defines the existing profiles, documents, chunks, chats,
  messages, and feedback tables, including the 768-dimensional vector column.

Run focused unit tests with `npm.cmd test`.
