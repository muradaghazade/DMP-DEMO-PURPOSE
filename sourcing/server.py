#!/usr/bin/env python3
"""Sourcing module demo server.

Serves the static app AND persists the application state server-side:
  GET  /api/state       -> data/state.json (204 if none yet)
  POST /api/state       -> saves the state atomically + keeps rolling backups
                           in data/backups/ (last 30)
  POST /api/handoff     -> stores a shopping-cart payload pushed from the
                           Demand Planning module (CORS-enabled); returns {id}
  GET  /api/handoff/<id>-> returns that payload once (consumed by the RFX form)

All data therefore lives on disk in the project folder and survives browser
cache/localStorage wipes.

Avoids os.getcwd() (blocked in sandbox) by serving an explicit absolute directory.
Optional argv[1] overrides the port (default 8124).
"""
import os
import re
import sys
import json
import time
import threading
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8124
DATA_DIR = os.path.join(ROOT, "data")
STATE_FILE = os.path.join(DATA_DIR, "state.json")
BACKUP_DIR = os.path.join(DATA_DIR, "backups")
HANDOFF_DIR = os.path.join(DATA_DIR, "handoffs")
KEEP_BACKUPS = 30
_HANDOFF_ID = re.compile(r"^[A-Za-z0-9_-]{1,64}$")

_LOCK = threading.Lock()


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

    def _send_json(self, status, body, cors=False):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        if cors:
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # local dev server: always revalidate, so a refresh never runs stale app code
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    # the Demand Planning app (a different origin/port) pushes cart handoffs here
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]
        # the shared platform landing page (one file for dev and the static build)
        if path == "/main":
            try:
                with open(os.path.join(os.path.dirname(ROOT), "landing.html"), "rb") as f:
                    body = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            except Exception:
                pass
        if path.startswith("/api/handoff/"):
            hid = path[len("/api/handoff/"):]
            if not _HANDOFF_ID.match(hid):
                self._send_json(400, b'{"error":"bad_id"}', cors=True)
                return
            fp = os.path.join(HANDOFF_DIR, hid + ".json")
            if not os.path.exists(fp):
                self._send_json(404, b'{"error":"not_found"}', cors=True)
                return
            with open(fp, "rb") as f:
                self._send_json(200, f.read(), cors=True)
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
        path = self.path.split("?")[0]
        if path == "/api/handoff":
            try:
                length = int(self.headers.get("Content-Length", "0"))
                body = self.rfile.read(length) if 0 < length <= 8 * 1024 * 1024 else None
                json.loads(body)  # store only well-formed JSON
            except Exception:
                body = None
            if body is None:
                self._send_json(400, b'{"error":"bad_request"}', cors=True)
                return
            os.makedirs(HANDOFF_DIR, exist_ok=True)
            hid = "h%d" % int(time.time() * 1000)
            with open(os.path.join(HANDOFF_DIR, hid + ".json"), "wb") as f:
                f.write(body)
            self._send_json(200, json.dumps({"ok": True, "id": hid}).encode(), cors=True)
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
                self._send_json(409, b'{"ok":false,"reason":"stale"}')
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
        self._send_json(200, b'{"ok":true}')

    def log_message(self, *args):
        pass


# ---- companion module: Demand Planning ------------------------------------
# One command runs the whole demo: if the sibling dp_pro folder exists and
# port 8123 is free, its server is spawned as a child process (and stopped
# again when this server exits).
DP_DIR = os.path.join(os.path.dirname(ROOT), "dp_pro")
DP_PORT = 8123


def _start_demand_planning():
    import socket
    import atexit
    import subprocess
    dp_server = os.path.join(DP_DIR, "server.py")
    if not os.path.exists(dp_server):
        return
    s = socket.socket()
    try:
        s.settimeout(0.5)
        s.connect(("127.0.0.1", DP_PORT))
        print("Demand Planning already running on http://127.0.0.1:%d" % DP_PORT)
        return
    except Exception:
        pass
    finally:
        try:
            s.close()
        except Exception:
            pass
    try:
        proc = subprocess.Popen([sys.executable, dp_server, str(DP_PORT)],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        atexit.register(proc.terminate)
        print("Demand Planning started on http://127.0.0.1:%d (pid %d)" % (DP_PORT, proc.pid))
    except Exception as e:
        print("Could not start Demand Planning: %s" % e)


_start_demand_planning()

httpd = ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(Handler))
print("Sourcing demo on http://127.0.0.1:%d (root=%s, state=%s)" % (PORT, ROOT, STATE_FILE))
httpd.serve_forever()
