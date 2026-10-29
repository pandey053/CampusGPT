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
    (1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding))::double precision
  from public.chunks as c
  join public.documents as d on d.id = c.document_id
  where c.embedding is not null
    and d.metadata ->> 'processing_status' = 'processed'
    and (1 - (c.embedding OPERATOR(extensions.<=>) p_query_embedding)) >=
      greatest(least(p_match_threshold, 1.0), 0.0)
  order by c.embedding OPERATOR(extensions.<=>) p_query_embedding
  limit least(greatest(p_match_count, 1), 8);
$$;

revoke all on function public.match_document_chunks(
  extensions.vector(768), real, integer
) from public, anon;
grant execute on function public.match_document_chunks(
  extensions.vector(768), real, integer
) to authenticated;

notify pgrst, 'reload schema';
