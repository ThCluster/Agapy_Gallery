"""Sonde Docker : GET http://127.0.0.1:8010/healthz avec le premier nom de ALLOWED_HOSTS (code 0 si 200)."""
import os
import sys
import urllib.request

host = (os.environ.get("ALLOWED_HOSTS", "localhost").split(",")[0].strip() or "localhost").lstrip(".")
req = urllib.request.Request("http://127.0.0.1:8010/healthz", headers={"Host": host})
try:
    with urllib.request.urlopen(req, timeout=4) as resp:
        sys.exit(0 if resp.status == 200 else 1)
except Exception:
    sys.exit(1)
