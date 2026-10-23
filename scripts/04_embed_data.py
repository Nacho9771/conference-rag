"""Generate resumable embeddings, validating cached text before reuse."""
import hashlib
import json
from pathlib import Path
from openai import OpenAI
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'scripts/output'

def record_key(record):
    return hashlib.sha256((record['talk_id'] + ':' + str(record['sentence_num']) + ':' + record['text']).encode()).hexdigest()

def main():
    records = json.loads((OUT / 'sentences.json').read_text(encoding='utf-8'))
    secret = json.loads((ROOT / 'config.secret.json').read_text(encoding='utf-8'))
    client = OpenAI(api_key=secret['OPENAI_API_KEY'], max_retries=3, timeout=60)
    cache_path = OUT / 'embedding-cache.jsonl'
    cached = {}
    if cache_path.exists():
        for line in cache_path.read_text(encoding='utf-8').splitlines():
            try:
                item = json.loads(line)
                if len(item['embedding']) == 1536:
                    cached[item['key']] = item['embedding']
            except (ValueError, KeyError):
                pass
    pending = [r for r in records if record_key(r) not in cached]
    print(f'{len(records)} sentences; {len(pending)} need embeddings. Model: text-embedding-3-small')
    with cache_path.open('a', encoding='utf-8') as cache:
        for start in tqdm(range(0, len(pending), 64), desc='Embedding'):
            batch = pending[start:start + 64]
            try:
                result = client.embeddings.create(model='text-embedding-3-small', input=[r['text'] for r in batch], dimensions=1536)
            except Exception as exc:
                # Provider exceptions may contain key fragments; log only class/status.
                raise SystemExit(f'Embedding stopped: {type(exc).__name__}, HTTP {getattr(exc, "status_code", "unknown")}. Completed batches are cached.') from None
            for record, item in zip(batch, sorted(result.data, key=lambda item: item.index)):
                key = record_key(record)
                cached[key] = item.embedding
                cache.write(json.dumps({'key': key, 'embedding': item.embedding}) + '\n')
            cache.flush()
    target = OUT / 'sentences_with_embeddings.json'
    temporary = target.with_suffix('.tmp')
    with temporary.open('w', encoding='utf-8') as output:
        output.write('[')
        for index, record in enumerate(records):
            if index: output.write(',')
            json.dump({**record, 'embedding': cached[record_key(record)]}, output, ensure_ascii=False)
        output.write(']')
    temporary.replace(target)
    print(f'Complete: {len(records)} embeddings saved to {target.name}')

if __name__ == '__main__':
    main()
