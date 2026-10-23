import base64
import json
import sys
import unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from _config import require_server_key


class ImportConfigTests(unittest.TestCase):
    def test_public_keys_cannot_be_used_for_import(self):
        anon = 'header.' + base64.urlsafe_b64encode(json.dumps({'role':'anon'}).encode()).decode() + '.signature'
        for key in [None, '', 'placeholder', 'sb_publishable_example', anon]:
            with self.assertRaises(ValueError):
                require_server_key(key)

    def test_server_key_formats(self):
        secret = 'sb_secret_example'
        self.assertEqual(require_server_key(secret), secret)
        service = 'header.' + base64.urlsafe_b64encode(json.dumps({'role':'service_role'}).encode()).decode() + '.signature'
        self.assertEqual(require_server_key(service), service)


if __name__ == '__main__':
    unittest.main()
