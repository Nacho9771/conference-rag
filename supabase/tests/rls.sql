-- Run as postgres. All fixtures roll back; no test users or notes remain.
begin;
insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
insert into public.sentence_embeddings(talk_id,title,text) values (gen_random_uuid(),'RLS fixture','Shared corpus fixture');
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
insert into public.notebooks(id,title) values ('33333333-3333-4333-8333-333333333333','Alice notebook');
do $$ begin
  if (select count(*) from public.notebooks) <> 1 then raise exception 'Owner cannot read'; end if;
  if not exists(select 1 from public.sentence_embeddings where title='RLS fixture') then raise exception 'Signed-in corpus read denied'; end if;
  update public.notebooks set notes='Owner edit' where id='33333333-3333-4333-8333-333333333333';
  if not found then raise exception 'Owner cannot update'; end if;
  begin
    update public.notebooks set owner_id='22222222-2222-4222-8222-222222222222';
    raise exception 'Ownership reassignment allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.notebooks(title,owner_id) values ('Forged','22222222-2222-4222-8222-222222222222');
    raise exception 'Forged ownership allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.sentence_embeddings(talk_id,title,text) values(gen_random_uuid(),'Forged','Forged');
    raise exception 'Corpus modification allowed';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
do $$ begin
  if exists(select 1 from public.notebooks) then raise exception 'Cross-user read allowed'; end if;
  update public.notebooks set notes='Attack';
  if found then raise exception 'Cross-user update allowed'; end if;
  delete from public.notebooks;
  if found then raise exception 'Cross-user delete allowed'; end if;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
insert into public.page_views(page_url) values('/');
do $$ begin
  if not exists(select 1 from public.page_views) then raise exception 'Public counter read denied'; end if;
  if exists(select 1 from public.sentence_embeddings) then raise exception 'Anonymous corpus read allowed'; end if;
  begin
    perform * from public.notebooks;
    raise exception 'Anonymous notebook read allowed';
  exception when insufficient_privilege then null; end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
do $$ begin
  delete from public.notebooks where id='33333333-3333-4333-8333-333333333333';
  if not found then raise exception 'Owner cannot delete'; end if;
end $$;
rollback;
select 'PASS: owner CRUD, cross-user isolation, forged ownership, corpus access, and public counter' as result;
