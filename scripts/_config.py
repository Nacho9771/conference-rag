"""Fail early when an import is accidentally configured with a public key."""
import base64
import json


def require_server_key(key):
    if not isinstance(key, str):
        raise ValueError('A Supabase server key is required for imports.')
    if key.startswith('sb_secret_'):
        return key
    try:
        role = json.loads(base64.urlsafe_b64decode(key.split('.')[1] + '===')).get('role')
        if role == 'service_role':
            return key
    except (ValueError, IndexError, UnicodeError):
        pass
    raise ValueError('Imports require a secret or service_role key, not a publishable or anon key. Update SUPABASE_SERVICE_KEY in config.secret.json.')
