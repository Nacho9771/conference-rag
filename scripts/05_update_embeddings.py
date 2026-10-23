"""
Step 5: Import Embeddings to Database
=========================================
Reads scripts/output/sentences_with_embeddings.json and imports
all records (text + embeddings) to Supabase, replacing any
existing data.

After this step, SEMANTIC SEARCH will light up green on your site!

Usage:
    python scripts/05_update_embeddings.py

Input:
    scripts/output/sentences_with_embeddings.json  — from Step 4

Prerequisites:
    - config.public.json with Supabase URL and anon key
    - config.secret.json with Supabase service key
    - Database schema created (Step 1)
    - Embeddings generated (Step 4)
"""

import json
import os
import sys
import time

from supabase import create_client
from tqdm import tqdm
from _config import require_server_key


INPUT_FILE = os.path.join('scripts', 'output', 'sentences_with_embeddings.json')
BATCH_SIZE = 100


def load_config():
    with open('config.public.json', 'r') as f:
        public_config = json.load(f)
    with open('config.secret.json', 'r', encoding='utf-8-sig') as f:
        secrets = json.load(f)
    require_server_key(secrets.get('SUPABASE_SERVICE_KEY'))
    return public_config, secrets


def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ {INPUT_FILE} not found. Run scripts/04_embed_data.py first.")
        sys.exit(1)

    # Load embedded records
    print("Loading embeddings data...")
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        records = json.load(f)

    # Verify embeddings are present
    with_embeddings = sum(1 for r in records if r.get('embedding'))
    without_embeddings = len(records) - with_embeddings

    print(f"   Loaded {len(records):,} records")
    print(f"   With embeddings:    {with_embeddings:,}")
    if without_embeddings:
        print(f"   Without embeddings: {without_embeddings:,} (will be imported without)")

    # Connect to Supabase
    public_config, secrets = load_config()
    client = create_client(public_config['SUPABASE_URL'], secrets['SUPABASE_SERVICE_KEY'])

    print('Checking existing embeddings before resuming the upload...')
    existing = {}
    offset = 0
    while True:
        page = client.table('sentence_embeddings').select('talk_id,sentence_num,text').not_.is_('embedding', 'null').order('talk_id').order('sentence_num').range(offset, offset + 999).execute().data
        for row in page:
            existing[(row['talk_id'], row['sentence_num'])] = row['text']
        if len(page) < 1000:
            break
        offset += 1000
    records = [r for r in records if existing.get((r['talk_id'], r['sentence_num'])) != r['text']]
    print(f'{len(records)} records need upload; completed records will be preserved.')

    # Batch import (much faster than individual updates!)
    print(f"\n   Importing {len(records):,} records in batches of {BATCH_SIZE}...\n")

    success = 0
    errors = 0

    for i in tqdm(range(0, len(records), BATCH_SIZE), desc="Importing"):
        batch = records[i:i + BATCH_SIZE]
        for attempt in range(3):
            try:
                client.table('sentence_embeddings').upsert(batch, on_conflict='talk_id,sentence_num', returning='minimal').execute()
                success += len(batch)
                break
            except Exception as e:
                if attempt == 2:
                    print(f"\nBatch {i // BATCH_SIZE} failed: {type(e).__name__}, code {getattr(e, 'code', 'unknown')}")
                    errors += len(batch)
                else:
                    time.sleep(2 ** attempt)
        time.sleep(0.1)

    print(f"\n✅ Import complete!")
    print(f"   Success: {success:,}")
    if errors:
        print(f"   Errors:  {errors:,}")
        sys.exit(1)

    # Verify
    result = client.table('sentence_embeddings').select('id', count='exact').limit(1).execute()
    total = result.count or 0

    embedded_result = client.table('sentence_embeddings') \
        .select('id', count='exact') \
        .not_.is_('embedding', 'null') \
        .limit(1).execute()
    with_emb = embedded_result.count or 0

    print(f"\n   Total rows:          {total:,}")
    print(f"   Rows with embeddings: {with_emb:,}")

    print(f"\n🎉 Semantic Search is now ready!")
    print(f"   Refresh your site — the 🧠 Semantic Search panel should turn GREEN.")
    print(f"\nNext: Deploy edge functions to light up 🤖 RAG!")


if __name__ == '__main__':
    main()
