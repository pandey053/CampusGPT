import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20261029060000_secure_chat_exchange.sql",
  "utf8",
);

describe("secure chat exchange migration", () => {
  it("is transactional and can replace the exact trusted RPC signature", () => {
    expect(migration.trimStart()).toMatch(/^begin;/i);
    expect(migration.trimEnd()).toMatch(/commit;$/i);
    expect(migration).toMatch(
      /create or replace function public\.save_chat_exchange\(\s*p_user_id uuid,\s*p_chat_id uuid,\s*p_question text,\s*p_answer text,\s*p_citations jsonb,\s*p_evidence_found boolean\s*\)/i,
    );
  });

  it("retires both exposed overloads and grants only the new signature to service_role", () => {
    expect(migration).toMatch(
      /drop function if exists public\.save_chat_exchange\(uuid, text, text, jsonb\)/i,
    );
    expect(migration).toMatch(
      /drop function if exists public\.save_chat_exchange\(\s*uuid, text, text, jsonb, boolean\s*\)/i,
    );
    expect(migration).toMatch(/to_regprocedure\(/i);
    expect(migration).toMatch(/on delete cascade/i);
    expect(migration).toMatch(
      /revoke insert, update on table public\.messages\s+from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /revoke all on function public\.save_chat_exchange\(\s*uuid, uuid, text, text, jsonb, boolean\s*\) from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.save_chat_exchange\(\s*uuid, uuid, text, text, jsonb, boolean\s*\) to service_role/i,
    );
  });

  it("requires the service_role claim and validates the student and chat owner", () => {
    expect(migration).toMatch(
      /coalesce\(auth\.role\(\), ''\) <> 'service_role'/i,
    );
    expect(migration).toMatch(
      /v_role is distinct from 'student'::public\.app_role/i,
    );
    expect(migration).toMatch(/v_owner_id is distinct from p_user_id/i);
    expect(migration).toMatch(
      /insert into public\.messages \(chat_id, sender, content, evidence_found\)\s+values \(p_chat_id, 'user', btrim\(p_question\), null\)/i,
    );
    expect(migration).toMatch(
      /'assistant',\s+btrim\(p_answer\),\s+p_citations,\s+p_evidence_found,\s+user_message_id/i,
    );
    expect(migration).toMatch(
      /add constraint messages_evidence_found_sender_check\s+check \(\s*sender = 'user'\s+or evidence_found is null\s+or question_message_id is not null\s*\)/i,
    );
    expect(migration).toMatch(
      /answer\.question_message_id = question\.id[\s\S]*?answer\.sender = 'assistant'[\s\S]*?answer\.evidence_found is false/i,
    );
  });

  it("scopes every analytics aggregate to student-owned chats", () => {
    const analytics = migration.slice(
      migration.indexOf("create or replace function public.get_admin_analytics()"),
    );

    expect(analytics.match(/join public\.chats as c on c\.user_id = m\.chat_id/g)).toBeNull();
    expect(analytics).toMatch(
      /join public\.chats as c on c\.id = m\.chat_id[\s\S]*?join public\.profiles as p[\s\S]*?p\.role = 'student'::public\.app_role/i,
    );
    expect(analytics).toMatch(
      /from public\.feedback as f\s+join public\.messages as m on m\.id = f\.message_id/i,
    );
    expect(analytics).toMatch(
      /join public\.messages as m on m\.id = f\.message_id[\s\S]*?join public\.chats as c on c\.id = m\.chat_id[\s\S]*?join public\.profiles as p[\s\S]*?p\.role = 'student'::public\.app_role[\s\S]*?where m\.sender = 'assistant'\s+and f\.user_id = c\.user_id/i,
    );
    expect(analytics).toMatch(
      /join public\.chats as c on c\.id = question\.chat_id[\s\S]*?join public\.profiles as p[\s\S]*?p\.role = 'student'::public\.app_role/i,
    );
    expect(analytics).toMatch(
      /revoke all on function public\.get_admin_analytics\(\)\s+from public, anon, service_role/i,
    );
    expect(analytics).toMatch(
      /grant execute on function public\.get_admin_analytics\(\) to authenticated/i,
    );
  });
});
