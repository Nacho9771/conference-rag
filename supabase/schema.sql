-- Conference corpus: shared with signed-in users; imports are administrative.
create extension if not exists vector with schema extensions;
create table public.sentence_embeddings (
  id uuid primary key default gen_random_uuid(),
  talk_id uuid not null, title text not null, speaker text, calling text,
  year integer, season text, url text, sentence_num integer,
  text text not null, embedding extensions.vector(1536),
  created_at timestamptz not null default now(),
  unique (talk_id, sentence_num)
);
create index sentence_embeddings_talk_order on public.sentence_embeddings(talk_id, sentence_num);
alter table public.sentence_embeddings enable row level security;
revoke all on public.sentence_embeddings from anon, authenticated;
grant select on public.sentence_embeddings to anon, authenticated;
grant all on public.sentence_embeddings to service_role;
create policy "Signed-in readers" on public.sentence_embeddings for select to authenticated using (true);

-- Public, deliberately non-sensitive counter for the assignment's RLS contrast.
create table public.page_views (
  id uuid primary key default gen_random_uuid(),
  visited_at timestamptz not null default now(),
  page_url text not null default '/' check (page_url = '/')
);
alter table public.page_views enable row level security;
revoke all on public.page_views from anon, authenticated;
grant select, insert on public.page_views to anon, authenticated;
grant all on public.page_views to service_role;
create policy "Public counter reads" on public.page_views for select to anon, authenticated using (true);
create policy "Public counter inserts" on public.page_views for insert to anon, authenticated with check (page_url = '/');

create function public.match_sentences(query_embedding extensions.vector(1536), match_count integer default 20)
returns table(id uuid, talk_id uuid, title text, speaker text, url text, text text, similarity double precision)
language sql stable security invoker set search_path = public, extensions
as $$
  select s.id, s.talk_id, s.title, s.speaker, s.url, s.text,
    1 - (s.embedding <=> query_embedding) as similarity
  from public.sentence_embeddings s
  where s.embedding is not null
  order by s.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 20), 50));
$$;
revoke all on function public.match_sentences(extensions.vector, integer) from public, anon;
grant execute on function public.match_sentences(extensions.vector, integer) to authenticated;

-- Personal notes and saved sources never become part of the shared RAG corpus.
create table public.notebooks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  purpose text not null default 'study' check (purpose in ('study', 'lesson', 'talk')),
  notes text not null default '' check (char_length(notes) <= 100000),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources) = 'array' and octet_length(sources::text) <= 500000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notebooks_owner_updated on public.notebooks(owner_id, updated_at desc);
alter table public.notebooks enable row level security;
revoke all on public.notebooks from anon, authenticated;
grant select, insert, update, delete on public.notebooks to authenticated;
grant all on public.notebooks to service_role;
create policy "Read own notebooks" on public.notebooks for select to authenticated using ((select auth.uid()) = owner_id);
create policy "Create own notebooks" on public.notebooks for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy "Edit own notebooks" on public.notebooks for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy "Delete own notebooks" on public.notebooks for delete to authenticated using ((select auth.uid()) = owner_id);
