// Tiny dependency-free static file server for the built prototype.
// Why not Parcel's dev server? Multiple Parcel dev servers from one project
// root cross-contaminate (every port serves one entry), and a single
// multi-entry dev server falls back to the first entry for every URL. For a
// throwaway "flip between references" round, a static serve of the build is
// correct and reliable. Rebuild with `npm run build` to pick up edits.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const ROOT = join(import.meta.dirname, "dist");
const PORT = Number(process.env.PORT || 4000);
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

http
  .createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      p = normalize(p).replace(/^(\.\.[/\\])+/, "");
      let file = join(ROOT, p);
      let s = await stat(file).catch(() => null);
      if (s?.isDirectory()) file = join(file, "index.html"), s = await stat(file).catch(() => null);
      if (!s?.isFile()) {
        res.writeHead(404); res.end("not found"); return;
      }
      res.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] || "application/octet-stream" });
      res.end(await readFile(file));
    } catch (e) {
      res.writeHead(500); res.end(String(e));
    }
  })
  .listen(PORT, () => {
    console.log(`\n  PLB prototype — http://localhost:${PORT}\n  (round 1 references: /references/mlb · /references/fpl · /references/eafc)\n`);
  });
