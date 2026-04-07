#!/usr/bin/env python3
"""
Servidor de desarrollo con soporte HTTP Range.
Chrome requiere respuestas 206 Partial Content para hacer scrubbing de video.
"""
import http.server, os

class RangeHandler(http.server.SimpleHTTPRequestHandler):

    def do_GET(self):
        self._serve(head=False)

    def do_HEAD(self):
        self._serve(head=True)

    def _serve(self, head=False):
        path = self.translate_path(self.path.split("?")[0])

        if os.path.isdir(path):
            super().do_GET()
            return

        try:
            f = open(path, "rb")
        except OSError:
            self.send_error(404, "File not found")
            return

        size  = os.path.getsize(path)
        ctype = self.guess_type(path)

        start, end = 0, size - 1
        partial = False
        rng = self.headers.get("Range", "")
        if rng.startswith("bytes="):
            partial = True
            parts = rng[6:].split("-")
            start = int(parts[0]) if parts[0] else 0
            end   = int(parts[1]) if len(parts) > 1 and parts[1] else size - 1
            end   = min(end, size - 1)

        length = end - start + 1

        if partial:
            self.send_response(206)
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        else:
            self.send_response(200)

        self.send_header("Content-Type",   ctype)
        self.send_header("Accept-Ranges",  "bytes")
        self.send_header("Content-Length", str(length))
        self.send_header("Cache-Control",  "no-store, no-cache")
        self.end_headers()

        if not head:
            f.seek(start)
            remaining = length
            while remaining > 0:
                chunk = f.read(min(65536, remaining))
                if not chunk:
                    break
                self.wfile.write(chunk)
                remaining -= len(chunk)
        f.close()

    def log_message(self, format, *args):
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
http.server.test(HandlerClass=RangeHandler, port=3000, bind="")
