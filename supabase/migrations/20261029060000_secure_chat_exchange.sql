begin;

do $$
begin
  if to_regprocedure(
    'public.save_chat_exchange(uuid,text,text,jsonb)'
  ) is not null then
    execute 'revoke all on function public.save_chat_exchange(uuid, text, text, jsonb) from public, anon, authenticated';
  end if;

  if to_regprocedure(
    'public.save_chat_exchange(uuid,text,text,jsonb,boolean)'
  ) is not null then
    execute 'revoke all on function public.save_chat_exchange(uuid, text, text, jsonb, boolean) from public, anon, authenticated, service_role';
  end if;
end;
$$;

drop function if exists public.save_chat_exchange(uuid, text, text, jsonb);
drop function if exists public.save_chat_exchange(
  uuid, text, text, jsonb, boolean
);

alter table public.messages
  add column if not exists question_message_id uuid;

alter table public.messages
  drop constraint if exists messages_question_message_id_fkey;

alter table public.messages
  add constraint messages_question_message_id_fkey
  foreign key (question_message_id)
  references public.messages(id)
  on delete cascade;

create unique index if not exists messages_question_message_id_idx
  on public.messages (question_message_id)
  where question_message_id is not null;

alter table public.messages
  drop constraint if exists messages_evidence_found_sender_check;

alter table public.messages
  add constraint messages_evidence_found_sender_check
  check (
    sender = 'user'
    or evidence_found is null
    or question_message_id is not null
  );

alter table public.messages
  drop constraint if exists messages_question_message_sender_check;

alter table public.messages
  add constraint messages_question_message_sender_check
  check (sender = 'assistant' or question_message_id is null);

revoke insert, update on table public.messages
  from public, anon, authenticated;

create or replace function public.save_chat_exchange(
  p_user_id uuid,
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
  v_role public.app_role;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception using
      errcode = '42501',
      message = 'Chat exchanges must be saved by the trusted server.';
  end if;

  if p_user_id is null or p_chat_id is null then
    raise exception using
      errcode = '22023',
      message = 'The chat exchange is invalid.';
  end if;

  select p.role
    into v_role
    from public.profiles as p
    where p.id = p_user_id;

  if v_role is distinct from 'student'::public.app_role then
    raise exception using
      errcode = '42501',
      message = 'A student account is required to save this chat exchange.';
  end if;

  select c.user_id
    into v_owner_id
    from public.chats as c
    where c.id = p_chat_id;

  if v_owner_id is distinct from p_user_id then
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
  values (p_chat_id, 'user', btrim(p_question), null)
  returning id into user_message_id;

  insert into public.messages (
    chat_id,
    sender,
    content,
    citations,
    evidence_found,
    question_message_id
  )
  values (
    p_chat_id,
    'assistant',
    btrim(p_answer),
    p_citations,
    p_evidence_found,
    user_message_id
  )
  returning id into assistant_message_id;

  update public.chats
    set updated_at = now()
    where id = p_chat_id;

  return next;
end;
$$;

revoke all on function public.save_chat_exchange(
  uuid, uuid, text, text, jsonb, boolean
) from public, anon, authenticated;
grant execute on function public.save_chat_exchange(
  uuid, uuid, text, text, jsonb, boolean
) to service_role;

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
    from public.feedback as f
    join public.messages as m on m.id = f.message_id
    join public.chats as c on c.id = m.chat_id
    join public.profiles as p
      on p.id = c.user_id
     and p.role = 'student'::public.app_role
    where m.sender = 'assistant'
      and f.user_id = c.user_id;

  return jsonb_build_object(
    'total_questions', (
      select count(*)
      from public.messages as m
      join public.chats as c on c.id = m.chat_id
      join public.profiles as p
        on p.id = c.user_id
       and p.role = 'student'::public.app_role
      where m.sender = 'user'
    ),
    'total_responses', (
      select count(*)
      from public.messages as m
      join public.chats as c on c.id = m.chat_id
      join public.profiles as p
        on p.id = c.user_id
       and p.role = 'student'::public.app_role
      where m.sender = 'assistant'
    ),
    'unanswered_questions', (
      select count(*)
      from public.messages as question
      join public.chats as c on c.id = question.chat_id
      join public.profiles as p
        on p.id = c.user_id
       and p.role = 'student'::public.app_role
      where question.sender = 'user'
        and (
          question.evidence_found is false
          or exists (
            select 1
            from public.messages as answer
            where answer.question_message_id = question.id
              and answer.chat_id = question.chat_id
              and answer.sender = 'assistant'
              and answer.evidence_found is false
          )
        )
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
        select btrim(m.content) as question, count(*) as question_count,
          max(m.created_at) as last_asked_at
        from public.messages as m
        join public.chats as c on c.id = m.chat_id
        join public.profiles as p
          on p.id = c.user_id
         and p.role = 'student'::public.app_role
        where m.sender = 'user'
        group by btrim(m.content)
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
        select btrim(question.content) as question,
          question.created_at as asked_at
        from public.messages as question
        join public.chats as c on c.id = question.chat_id
        join public.profiles as p
          on p.id = c.user_id
         and p.role = 'student'::public.app_role
        where question.sender = 'user'
          and (
            question.evidence_found is false
            or exists (
              select 1
              from public.messages as answer
              where answer.question_message_id = question.id
                and answer.chat_id = question.chat_id
                and answer.sender = 'assistant'
                and answer.evidence_found is false
            )
          )
        order by question.created_at desc
        limit 20
      ) as unanswered
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_admin_analytics()
  from public, anon, service_role;
grant execute on function public.get_admin_analytics() to authenticated;

notify pgrst, 'reload schema';

commit;
