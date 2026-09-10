#!/usr/bin/env python3
"""Demand Planning demo server.

Serves the static app AND persists the application state server-side:
  GET  /api/state  -> data/state.json (204 if none yet)
  POST /api/state  -> saves the state atomically + keeps rolling backups
                      in data/backups/ (last 30)

All data — items, requests, uploaded images — therefore lives on disk in
the project folder and survives browser cache/localStorage wipes.

Avoids os.getcwd() (blocked in sandbox) by serving an explicit absolute directory.
Optional argv[1] overrides the port (default 8123).
"""
import os
import re
import sys
import json
import time
import threading
import functools
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123
DATA_DIR = os.path.join(ROOT, "data")
STATE_FILE = os.path.join(DATA_DIR, "state.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
KEEP_BACKUPS = 30

_LOCK = threading.Lock()

# ---- e-catalogue AI engine proxy -------------------------------------------
# The browser never sees the API key: it calls /api/ai/*, and this server
# forwards to the e-catalogue with the key read from the environment
# (ECAT_API_KEY) or the git-ignored .ecat_key file next to this script.
ECAT_BASE = os.environ.get('ECAT_BASE', 'https://ecatalogue.dmpservice.org/e-catalog/api/v1')
_JOB_ID = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


def _ecat_key():
    k = os.environ.get('ECAT_API_KEY')
    if k:
        return k.strip()
    try:
        with open(os.path.join(ROOT, '.ecat_key')) as f:
            return f.read().strip() or None
    except Exception:
        return None


def _stored_saved_at():
    try:
        with open(STATE_FILE, "rb") as f:
            return json.load(f).get("__savedAt") or 0
    except Exception:
        return 0


LAST_SAVED_AT = _stored_saved_at()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _api(self):
        return self.path.split("?")[0] == "/api/state"

    def _send_json(self, status, body):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _proxy_ai(self, method, upstream_path, body=None, idem_key=None):
        key = _ecat_key()
        if not key:
            self._send_json(503, b'{"error":"no_api_key"}')
            return
        req = urllib.request.Request(ECAT_BASE + upstream_path, data=body, method=method)
        req.add_header("X-API-Key", key)
        # the edge WAF rejects urllib's default Python User-Agent (error 1010)
        req.add_header("User-Agent", "dp-pro-demand-planning/1.0")
        if body is not None:
            req.add_header("Content-Type", "application/json")
        if idem_key:
            req.add_header("Idempotency-Key", idem_key)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                self._send_json(resp.status, resp.read())
        except urllib.error.HTTPError as e:
            self._send_json(e.code, e.read() or b'{}')
        except Exception as e:
            self._send_json(502, json.dumps({"error": "upstream_unreachable", "detail": str(e)}).encode())

    def end_headers(self):
        # local dev server: always revalidate, so a refresh never runs stale app code
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        if path.startswith("/api/ai/jobs/"):
            job_id = path[len("/api/ai/jobs/"):]
            if not _JOB_ID.match(job_id):
                self._send_json(400, b'{"error":"bad_job_id"}')
                return
            self._proxy_ai("GET", "/jobs/" + job_id)
            return
        if self._api():
            if os.path.exists(STATE_FILE):
                with open(STATE_FILE, "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            else:
                self.send_response(204)
                self.end_headers()
            return
        super().do_GET()

    def do_POST(self):
        if self.path.split("?")[0] == "/api/ai/classify":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length) if 0 < length <= 1024 * 1024 else None
                json.loads(body)          # forward only well-formed JSON
            except Exception:
                body = None
            if body is None:
                self._send_json(400, b'{"error":"bad_request"}')
                return
            self._proxy_ai("POST", "/classify", body=body,
                           idem_key=self.headers.get("Idempotency-Key"))
            return
        if not self._api():
            self.send_response(404)
            self.end_headers()
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = self.rfile.read(length)
            incoming = json.loads(body)  # must be valid JSON — never overwrite good data with garbage
        except Exception:
            self.send_response(400)
            self.end_headers()
            return
        # stale-write guard: a tab holding an older copy (e.g. its unload beacon
        # during a refresh) must never overwrite newer data already on disk
        global LAST_SAVED_AT
        with _LOCK:
            ts = (incoming.get("__savedAt") or 0) if isinstance(incoming, dict) else 0
            if ts < LAST_SAVED_AT:
                resp = b'{"ok":false,"reason":"stale"}'
                self.send_response(409)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return
            LAST_SAVED_AT = ts
        os.makedirs(DATA_DIR, exist_ok=True)
        os.makedirs(BACKUP_DIR, exist_ok=True)
        # rolling backup of the previous good state (at most one per minute)
        try:
            if os.path.exists(STATE_FILE):
                stamp = time.strftime("%Y%m%d-%H%M")
                bak = os.path.join(BACKUP_DIR, "state-%s.json" % stamp)
                if not os.path.exists(bak):
                    with open(STATE_FILE, "rb") as src, open(bak, "wb") as dst:
                        dst.write(src.read())
                    backups = sorted(os.listdir(BACKUP_DIR))
                    for old in backups[:-KEEP_BACKUPS]:
                        os.remove(os.path.join(BACKUP_DIR, old))
        except Exception:
            pass
        # atomic write: tmp file + rename, so a crash can never truncate the state
        tmp = STATE_FILE + ".tmp"
        with open(tmp, "wb") as f:
            f.write(body)
        os.replace(tmp, STATE_FILE)
        # keep the bundled snapshot (js/state-snapshot.js) in sync, so the repo
        # always ships the same data the local app shows — even opened statically
        try:
            snap = os.path.join(ROOT, "js", "state-snapshot.js")
            with open(snap + ".tmp", "wb") as f:
                f.write(b"window.STATE_SNAPSHOT = ")
                f.write(body)
                f.write(b";")
            os.replace(snap + ".tmp", snap)
        except Exception:
            pass
        resp = b'{"ok":true}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp)))
        self.end_headers()
        self.wfile.write(resp)

    def log_message(self, *args):
        pass


httpd = ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler))
print("Demand Planning demo on http://127.0.0.1:%d (root=%s, state=%s)" % (PORT, ROOT, STATE_FILE))
httpd.serve_forever()
