// Throwaway runtime smoke test: does each prototype's bundle actually MOUNT in
// a DOM under React 19? (Build success ≠ mount. Stitches+React19 is the risk.)
// Usage: node smoke.mjs <tailwind|shadcn|mui|stitches>
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";

const opt = process.argv[2];
const root = resolve(import.meta.dirname);
const htmlPath = resolve(root, "dist", opt, "index.html");
const html = readFileSync(htmlPath, "utf8");

// collect every module script src in document order (Parcel shares chunks
// across entries — the browser loads them all, so we do too).
const srcs = [...html.matchAll(/<script[^>]*\stype=module[^>]*src=([^\s>]+)/g)]
  .map((m) => m[1].replace(/["']/g, ""));
if (srcs.length === 0) throw new Error(`no module scripts in ${htmlPath}`);
const entries = srcs.map((s) => resolve(root, "dist", s.replace(/^\//, "")));

const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
  url: "http://localhost/",
  pretendToBeVisual: true,
});
const { window } = dom;

// polyfills the libs expect
window.matchMedia = () => ({
  matches: false, media: "", onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
});
class RO { observe() {} unobserve() {} disconnect() {} }
window.ResizeObserver = RO;
window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };

global.window = window;
global.document = window.document;
try { Object.defineProperty(global, "navigator", { value: window.navigator, configurable: true }); }
catch { /* Node 22 exposes a read-only navigator; libs read window.navigator anyway */ }
global.HTMLElement = window.HTMLElement;
global.getComputedStyle = window.getComputedStyle.bind(window);
global.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);
global.ResizeObserver = RO;

let mounted = false;
const errs = [];
window.addEventListener("error", (e) => errs.push(String(e.error || e.message)));
window.addEventListener("unhandledrejection", (e) => errs.push(String(e.reason)));

try {
  for (const e of entries) await import(pathToFileURL(e).href);
  // give effects / async mount a moment
  await new Promise((r) => setTimeout(r, 250));
  const app = window.document.getElementById("app");
  mounted = !!app && app.innerHTML.length > 50;
  console.log(JSON.stringify({
    option: opt,
    mounted,
    appChildNodes: app ? app.childNodes.length : 0,
    innerHTMLLen: app ? app.innerHTML.length : 0,
    errors: errs,
  }, null, 2));
  process.exit(mounted && errs.length === 0 ? 0 : 1);
} catch (e) {
  console.log(JSON.stringify({ option: opt, mounted: false, errors: [String(e && e.stack ? e.stack : e)], runtimeCrash: true }, null, 2));
  process.exit(1);
}
