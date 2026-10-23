# Commonplace — Conference study

A CS 452 Conference RAG extension for exploring topics, preparing lessons, and developing talks in your own voice. Built from the course starter. The three required search modes remain: keyword, semantic, and RAG.

## Custom feature: private study notebooks

Create a notebook for personal study, a lesson, or a talk. Keep source passages and AI summaries, write your own thoughts and outline, save to your account, and export Markdown. AI summaries are labeled and retain source links. Notes are not sent to OpenAI or mixed into the shared search corpus.

The notebook currently saves on request rather than autosaving. Switching notebooks or closing the page warns about unsaved changes. A notebook holds up to 50 collected sources in the interface. RLS owns the permission decision; the interface's owner filter is only an additional query constraint.

## Configuration and deployment

- GitHub fork: https://github.com/Nacho9771/conference-rag
- Intended Pages address: https://nacho9771.github.io/conference-rag/
- Supabase project: `rsdhzofmwlrynpdndgky`
- `config.public.json` holds the project URL and public publishable key. The starter's `SUPABASE_ANON_KEY` property name is retained for compatibility; its value is a modern publishable key.
- `config.secret.json` is ignored by Git. Keep OpenAI and service-role keys there for local scripts. Never publish it.
- Set `OPENAI_API_KEY` separately in Supabase Edge Function secrets.
- Set Auth Site URL to the Pages address; allow redirects to that address and `http://127.0.0.1:5500/`.
- Enable GitHub Pages from `main`, root folder.

Use `node scripts/serve.mjs` for a local preview. It only serves an explicit list of frontend files. A generic file server rooted at the repository could expose local credentials.

Install Python dependencies with `pip install -r requirements.lock.txt` in a virtual environment. Run scripts 02 through 05 in order. Step 04 caches paid embedding requests by stable sentence identity and content hash; reruns reuse matching results. Steps 03 and 05 upsert by `(talk_id, sentence_num)`. Step 05 skips already uploaded embeddings with matching sentence text and retries failed batches. Import configuration rejects public keys before sending write requests.

`supabase/schema.sql` is the initial schema already applied to this project's hosted database as `conference_and_private_notebooks`. It is for a fresh database, not a reset script. Schema changes should be applied as additional reviewed migrations. Do not rerun the original course schema over this schema.

The deployed functions use manual bearer-token verification against Supabase Auth. Platform `verify_jwt` is false because authentication is performed inside the handler. No OpenAI call occurs before verification. Requests have size limits, timeouts, and a restricted browser-origin list. CORS is not authentication: callers still need a verified user token.

## Access model

| Asset | Signed out | Signed in | Administrator |
| --- | --- | --- | --- |
| Conference corpus | No visible rows | Read | Import/update |
| Similarity RPC | Cannot execute | Read under caller's RLS | Administrative access |
| Page counter | Read/insert non-sensitive `/` record | Same | Manage |
| Notebooks | No access | CRUD own rows only | Administrative access |
| OpenAI API key | Never exposed | Never exposed | Server secret / local ignored file |

Both `USING` and `WITH CHECK` protect notebook updates. Owners cannot reassign notebooks to another user. `match_sentences` is security-invoker and returns source URLs. The public counter never records URL query strings, fragments, tokens, or user-agent strings. Public counter insertion is still intentionally open for the assignment demonstration and can be inflated.

## Verification

- `node --test tests/validation.test.mjs`: malformed questions and missing/oversized context.
- `node --check app.js` and `node --check notebooks.js`: JavaScript syntax.
- `supabase/tests/rls.sql`: transactional owner CRUD, cross-user read/update/delete denial, forged ownership denial, corpus write denial, anonymous corpus read filtering, and public counter behavior. Fixtures roll back.
- HTTP checks: unauthenticated and invalid-token Edge Function calls return 401; anonymous notebooks access returns 401; local secret URL returns 404.
- Supabase security advisor returned no findings after schema creation.

Live verification completed: the owner signed in through an email link; keyword search returned talks; an example lesson notebook saved and reopened after reload; Markdown export downloaded; and the RAG view displayed an answer with numbered source links. A separate API integration test used disposable accounts to verify function health, 1,536-dimensional question embeddings, 20 semantic matches, an answer with citations, notebook owner CRUD, cross-user isolation, and anonymous corpus isolation. The disposable accounts were removed after the test.

Talks are ranked by their strongest matching sentence. This avoids penalizing a relevant talk merely because it has several retrieved passages with different similarity scores. Relevance is never labeled as answer accuracy.

## Scope and future capacity

This is a course-scale implementation. It is not load-tested for millions of users. The corpus has 354 talks from 2022–2026 and 20,998 sentences. A cosine HNSW index (`supabase/search-index.sql`) was added after a live similarity query timed out during import. Approximate retrieval trades some nearest-neighbor recall for speed. Before a broad public launch, add durable per-user AI usage quotas, abuse controls, ingestion monitoring, and realistic load/cost tests. An authenticated user can currently make repeated AI requests. Set provider budget alerts and use an appropriate API project.

## Reflection preparation

Use the questions in `steps/07_make_it_yours.md`. Write your own account of what you learned. Useful evidence to discuss: the actual RLS tests; why the browser key differs from a service key; how the two Edge Functions verify callers; a real query where keyword and semantic results differ; how you chose the notebook feature; where you guided or corrected the assistant.

Do not claim that RAG eliminates hallucinations. Source grounding helps, but generated answers still need checking. Relevance scores measure vector similarity, not factual confidence.
