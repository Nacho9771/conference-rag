import { HttpError } from './validation.mjs';

const allowedOrigins = new Set(['https://nacho9771.github.io', 'http://localhost:5500', 'http://127.0.0.1:5500']);
export function handler(run: (body: any, key: string) => Promise<unknown>) {
  return async (req: Request) => {
    const origin = req.headers.get('origin');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin',
      'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    if (origin && allowedOrigins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    try {
      if (origin && !allowedOrigins.has(origin)) throw new HttpError(403, 'Origin not allowed.');
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
      const authorization = req.headers.get('authorization') || '';
      if (!/^Bearer\s+\S+$/i.test(authorization)) throw new HttpError(401, 'Please sign in.');
      // Verify with Supabase Auth; decoding a JWT alone does not authenticate it.
      const auth = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
        headers: { authorization, apikey: Deno.env.get('SUPABASE_ANON_KEY') || '' },
        signal: AbortSignal.timeout(10000),
      });
      if (!auth.ok) throw new HttpError(401, 'Your session has expired. Please sign in again.');
      const user = await auth.json();
      if (!user.id || user.is_anonymous) throw new HttpError(401, 'Please sign in with your email.');
      const reader = req.body?.getReader();
      if (!reader) throw new HttpError(400, 'JSON body required.');
      const chunks: Uint8Array[] = []; let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 200000) { await reader.cancel(); throw new HttpError(413, 'Request too large.'); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let body;
      try { body = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { throw new HttpError(400, 'Invalid JSON.'); }
      const key = Deno.env.get('OPENAI_API_KEY');
      if (body?.action === 'health') return json({ ready: Boolean(key) });
      if (!key) throw new HttpError(503, 'AI search is awaiting server configuration. Keyword search is still available.');
      return json(await run(body, key));
    } catch (error) {
      if (error instanceof HttpError) return json({ error: error.message }, error.status);
      console.error('Request failed:', error instanceof Error ? error.name : 'UnknownError');
      return json({ error: 'The service could not complete this request. Please try again.' }, 502);
    }
  };
}
export async function openai(path: string, key: string, body: unknown) {
  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 502,
    response.status === 429 ? 'AI usage limit reached. Try again later.' : 'AI provider unavailable. Please try again later.');
  return response.json();
}
