create extension if not exists vector with schema extensions;

do $$
begin
  if not exists (
    select 1
    from pg_type
    join pg_namespace on pg_namespace.oid = pg_type.typnamespace
    where pg_namespace.nspname = 'public'
      and pg_type.typname = 'message_sender'
  ) then
    create type public.message_sender as enum ('user', 'assistant');
  end if;
end;
$$;

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) > 0),
  description text,
  storage_path text unique,
  mime_type text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(btrim(content)) > 0),
  embedding extensions.vector(768),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text check (title is null or length(btrim(title)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats (id) on delete cascade,
  sender public.message_sender not null,
  content text not null check (length(btrim(content)) > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or length(btrim(comment)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, message_id)
);

create index if not exists documents_uploaded_by_idx
  on public.documents (uploaded_by);
create index if not exists chunks_document_id_chunk_index_idx
  on public.chunks (document_id, chunk_index);
create index if not exists chunks_embedding_hnsw_idx
  on public.chunks using hnsw (embedding extensions.vector_cosine_ops)
  where embedding is not null;
create index if not exists chats_user_id_updated_at_idx
  on public.chats (user_id, updated_at desc);
create index if not exists messages_chat_id_created_at_idx
  on public.messages (chat_id, created_at);
create index if not exists feedback_user_id_created_at_idx
  on public.feedback (user_id, created_at desc);
create index if not exists feedback_message_id_idx
  on public.feedback (message_id);

do $$
begin
  if to_regprocedure('public.set_updated_at()') is null then
    execute $create_function$
      create function public.set_updated_at()
      returns trigger
      language plpgsql
      set search_path = ''
      as $function$
      begin
        new.updated_at := now();
        return new;
      end;
      $function$
    $create_function$;
  end if;

  if to_regprocedure('public.is_admin()') is null then
    execute $create_function$
      create function public.is_admin()
      returns boolean
      language sql
      stable
      security definer
      set search_path = ''
      as $function$
        select exists (
          select 1
          from public.profiles
          where id = (select auth.uid())
            and role = 'admin'
        );
      $function$
    $create_function$;
  end if;
end;
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'documents_set_updated_at'
      and tgrelid = 'public.documents'::regclass
      and not tgisinternal
  ) then
    create trigger documents_set_updated_at
      before update on public.documents
      for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'chats_set_updated_at'
      and tgrelid = 'public.chats'::regclass
      and not tgisinternal
  ) then
    create trigger chats_set_updated_at
      before update on public.chats
      for each row execute function public.set_updated_at();
  end if;

  if not exists (
    select 1
    from pg_trigger
    where tgname = 'feedback_set_updated_at'
      and tgrelid = 'public.feedback'::regclass
      and not tgisinternal
  ) then
    create trigger feedback_set_updated_at
      before update on public.feedback
      for each row execute function public.set_updated_at();
  end if;
end;
$$;

alter table public.documents enable row level security;
alter table public.chunks enable row level security;
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.feedback enable row level security;

revoke all on public.documents, public.chunks, public.chats,
  public.messages, public.feedback
  from anon, authenticated;

grant select, insert, update, delete on public.documents, public.chunks,
  public.chats, public.messages, public.feedback to authenticated;
grant all on public.documents, public.chunks, public.chats,
  public.messages, public.feedback to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Authenticated users can read documents'
  ) then
    create policy "Authenticated users can read documents"
      on public.documents for select to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'documents'
      and policyname = 'Admins can manage documents'
  ) then
    create policy "Admins can manage documents"
      on public.documents for all to authenticated
      using ((select public.is_admin()))
      with check ((select public.is_admin()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chunks'
      and policyname = 'Authenticated users can read document chunks'
  ) then
    create policy "Authenticated users can read document chunks"
      on public.chunks for select to authenticated
      using (
        exists (
          select 1
          from public.documents
          where documents.id = chunks.document_id
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chunks'
      and policyname = 'Admins can manage document chunks'
  ) then
    create policy "Admins can manage document chunks"
      on public.chunks for all to authenticated
      using ((select public.is_admin()))
      with check ((select public.is_admin()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'chats'
      and policyname = 'Users can manage their own chats'
  ) then
    create policy "Users can manage their own chats"
      on public.chats for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'Users can read messages in their own chats'
  ) then
    create policy "Users can read messages in their own chats"
      on public.messages for select to authenticated
      using (
        exists (
          select 1
          from public.chats
          where chats.id = messages.chat_id
            and chats.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'Users can add their own messages'
  ) then
    create policy "Users can add their own messages"
      on public.messages for insert to authenticated
      with check (
        sender = 'user'
        and exists (
          select 1
          from public.chats
          where chats.id = messages.chat_id
            and chats.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'Users can update their own messages'
  ) then
    create policy "Users can update their own messages"
      on public.messages for update to authenticated
      using (
        sender = 'user'
        and exists (
          select 1
          from public.chats
          where chats.id = messages.chat_id
            and chats.user_id = (select auth.uid())
        )
      )
      with check (
        sender = 'user'
        and exists (
          select 1
          from public.chats
          where chats.id = messages.chat_id
            and chats.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'messages'
      and policyname = 'Users can delete their own messages'
  ) then
    create policy "Users can delete their own messages"
      on public.messages for delete to authenticated
      using (
        sender = 'user'
        and exists (
          select 1
          from public.chats
          where chats.id = messages.chat_id
            and chats.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Users can read their own feedback'
  ) then
    create policy "Users can read their own feedback"
      on public.feedback for select to authenticated
      using ((select auth.uid()) = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Users can leave feedback on their own chat responses'
  ) then
    create policy "Users can leave feedback on their own chat responses"
      on public.feedback for insert to authenticated
      with check (
        (select auth.uid()) = user_id
        and exists (
          select 1
          from public.messages
          join public.chats on chats.id = messages.chat_id
          where messages.id = feedback.message_id
            and messages.sender = 'assistant'
            and chats.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Users can update their own feedback'
  ) then
    create policy "Users can update their own feedback"
      on public.feedback for update to authenticated
      using ((select auth.uid()) = user_id)
      with check (
        (select auth.uid()) = user_id
        and exists (
          select 1
          from public.messages
          join public.chats on chats.id = messages.chat_id
          where messages.id = feedback.message_id
            and messages.sender = 'assistant'
            and chats.user_id = (select auth.uid())
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'feedback'
      and policyname = 'Users can delete their own feedback'
  ) then
    create policy "Users can delete their own feedback"
      on public.feedback for delete to authenticated
      using ((select auth.uid()) = user_id);
  end if;
end;
$$;

notify pgrst, 'reload schema';
