-- Applied after corpus import as index_conference_vectors_for_retrieval.
-- HNSW trades exact nearest-neighbor recall for faster retrieval.
set local statement_timeout = '180s';
create index if not exists sentence_embeddings_cosine_hnsw
  on public.sentence_embeddings using hnsw (embedding extensions.vector_cosine_ops) with (m = 8, ef_construction = 32);
analyze public.sentence_embeddings;
