alter table public.messages
  add column if not exists citations jsonb not null default '[]'::jsonb
  check (jsonb_typeof(citations) = 'array');

create or replace function public.match_document_chunks(
  p_query_embedding extensions.vector(768),
  p_match_threshold real default 0.55,
  p_match_count integer default 5
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  content text,
  metadata jsonb,
  similarity double precision
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.document_id,
    d.title,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> p_query_embedding))::double precision
  from public.chunks as c
  join public.documents as d on d.id = c.document_id
  where c.embedding is not null
    and d.metadata ->> 'processing_status' = 'processed'
    and (1 - (c.embedding <=> p_query_embedding)) >=
      greatest(least(p_match_threshold, 1.0), 0.0)
  order by c.embedding <=> p_query_embedding
  limit least(greatest(p_match_count, 1), 8);
$$;

revoke all on function public.match_document_chunks(
  extensions.vector(768), real, integer
) from public, anon;
grant execute on function public.match_document_chunks(
  extensions.vector(768), real, integer
) to authenticated;

create or replace function public.save_chat_exchange(
  p_chat_id uuid,
  p_question text,
  p_answer text,
  p_citations jsonb
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
  then
    raise exception using
      errcode = '22023',
      message = 'The chat exchange is invalid.';
  end if;

  insert into public.messages (chat_id, sender, content)
  values (p_chat_id, 'user', btrim(p_question))
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
  uuid, text, text, jsonb
) from public, anon;
grant execute on function public.save_chat_exchange(
  uuid, text, text, jsonb
) to authenticated;

notify pgrst, 'reload schema';
