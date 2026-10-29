alter table public.feedback
  add column if not exists sentiment text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.feedback'::regclass
      and conname = 'feedback_sentiment_check'
  ) then
    alter table public.feedback
      add constraint feedback_sentiment_check
      check (sentiment is null or sentiment in ('positive', 'negative'));
  end if;
end;
$$;

alter table public.messages
  add column if not exists evidence_found boolean;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.messages'::regclass
      and conname = 'messages_evidence_found_sender_check'
  ) then
    alter table public.messages
      add constraint messages_evidence_found_sender_check
      check (sender = 'user' or evidence_found is null);
  end if;
end;
$$;

drop policy if exists "Users can leave feedback on their own chat responses"
  on public.feedback;
create policy "Users can leave feedback on their own chat responses"
  on public.feedback for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and sentiment in ('positive', 'negative')
    and rating in (1, 5)
    and exists (
      select 1
      from public.messages
      join public.chats on chats.id = messages.chat_id
      where messages.id = feedback.message_id
        and messages.sender = 'assistant'
        and chats.user_id = (select auth.uid())
    )
  );

drop policy if exists "Users can update their own feedback"
  on public.feedback;
create policy "Users can update their own feedback"
  on public.feedback for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and sentiment in ('positive', 'negative')
    and rating in (1, 5)
    and exists (
      select 1
      from public.messages
      join public.chats on chats.id = messages.chat_id
      where messages.id = feedback.message_id
        and messages.sender = 'assistant'
        and chats.user_id = (select auth.uid())
    )
  );

create or replace function public.save_chat_exchange(
  p_chat_id uuid,
  p_question text,
  p_answer text,
  p_citations jsonb,
  p_evidence_found boolean
)
returns table (user_message_id uuid, assistant_message_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select c.user_id
    into v_owner_id
    from public.chats as c
    where c.id = p_chat_id;

  if v_owner_id is distinct from auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'The chat is not available to this user.';
  end if;

  if p_question is null or char_length(btrim(p_question)) not between 1 and 2000
    or p_answer is null or char_length(btrim(p_answer)) not between 1 and 12000
    or p_citations is null
    or jsonb_typeof(p_citations) <> 'array'
    or jsonb_array_length(p_citations) > 8
    or pg_column_size(p_citations) > 32768
    or p_evidence_found is null
  then
    raise exception using
      errcode = '22023',
      message = 'The chat exchange is invalid.';
  end if;

  insert into public.messages (chat_id, sender, content, evidence_found)
  values (p_chat_id, 'user', btrim(p_question), p_evidence_found)
  returning id into user_message_id;

  insert into public.messages (chat_id, sender, content, citations)
  values (p_chat_id, 'assistant', btrim(p_answer), p_citations)
  returning id into assistant_message_id;

  update public.chats
    set updated_at = now()
    where id = p_chat_id;

  return next;
end;
$$;

revoke all on function public.save_chat_exchange(
  uuid, text, text, jsonb, boolean
) from public, anon;
grant execute on function public.save_chat_exchange(
  uuid, text, text, jsonb, boolean
) to authenticated;

create or replace function public.get_admin_analytics()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_positive bigint;
  v_negative bigint;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception using
      errcode = '42501',
      message = 'Administrator access is required.';
  end if;

  select
    count(*) filter (where f.sentiment = 'positive'),
    count(*) filter (where f.sentiment = 'negative')
    into v_positive, v_negative
    from public.feedback as f;

  return jsonb_build_object(
    'total_questions', (
      select count(*) from public.messages where sender = 'user'
    ),
    'total_responses', (
      select count(*) from public.messages where sender = 'assistant'
    ),
    'unanswered_questions', (
      select count(*)
      from public.messages
      where sender = 'user' and evidence_found is false
    ),
    'positive_feedback', v_positive,
    'negative_feedback', v_negative,
    'feedback_positivity_percentage',
      case
        when v_positive + v_negative = 0 then null
        else round(v_positive::numeric * 100 / (v_positive + v_negative), 1)
      end,
    'top_questions', coalesce((
      select jsonb_agg(
        jsonb_build_object('question', question, 'count', question_count)
        order by question_count desc, last_asked_at desc
      )
      from (
        select btrim(content) as question, count(*) as question_count,
          max(created_at) as last_asked_at
        from public.messages
        where sender = 'user'
        group by btrim(content)
        order by question_count desc, last_asked_at desc
        limit 10
      ) as frequent
    ), '[]'::jsonb),
    'unanswered_question_list', coalesce((
      select jsonb_agg(
        jsonb_build_object('question', question, 'asked_at', asked_at)
        order by asked_at desc
      )
      from (
        select btrim(content) as question, created_at as asked_at
        from public.messages
        where sender = 'user' and evidence_found is false
        order by created_at desc
        limit 20
      ) as unanswered
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_analytics() from public, anon;
grant execute on function public.get_admin_analytics() to authenticated;

notify pgrst, 'reload schema';
