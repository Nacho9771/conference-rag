import { handler, openai } from '../_shared/handler.ts';
import { questionInput } from '../_shared/validation.mjs';
Deno.serve(handler(async (body, key) => {
  const question = questionInput(body);
  const data = await openai('embeddings', key, { model: 'text-embedding-3-small', input: question, dimensions: 1536 });
  return { embedding: data.data[0].embedding };
}));
