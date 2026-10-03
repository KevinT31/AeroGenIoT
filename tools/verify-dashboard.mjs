// Verificacion visual del dashboard y del Twin 3D con Playwright + Edge del sistema.
// Uso: node tools/verify-dashboard.mjs   (requiere dashboard en :5173 y backend en :3000)
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// playwright vive en las dependencias del dashboard
const require = createRequire(path.join(root, "app", "dashboard", "package.json"));
const { chromium } = require("playwright");
const shotsDir = path.join(root, "logs", "visual");
mkdirSync(shotsDir, { recursive: true });

const BASE = process.env.DASHBOARD_BASE || "http://localhost:5173";
const failures = [];

const checkPage = async (browser, { name, url, viewport, isMobile, expect3d }) => {
  const context = await browser.newContext({ viewport, isMobile, hasTouch: isMobile });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const url = msg.location()?.url || "";
    if (url.includes("favicon")) return; // Edge pide /favicon.ico automaticamente
    consoleErrors.push(`${msg.text()}${url ? ` (${url})` : ""}`);
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto(url, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(expect3d ? 6000 : 3500);

  if (expect3d) {
    const canvasInfo = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) return { found: false };
      const gl =
        canvas.getContext("webgl2") || canvas.getContext("webgl");
      const rect = canvas.getBoundingClientRect();
      // Muestrea pixeles del framebuffer para confirmar que no esta en blanco/negro plano
      let nonEmpty = 0;
      if (gl) {
        const w = gl.drawingBufferWidth;
        const h = gl.drawingBufferHeight;
        const pixels = new Uint8Array(4 * 64 * 64);
        gl.readPixels(Math.floor(w / 4), Math.floor(h / 4), 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
        const first = [pixels[0], pixels[1], pixels[2]];
        for (let i = 0; i < pixels.length; i += 4) {
          if (pixels[i] !== first[0] || pixels[i + 1] !== first[1] || pixels[i + 2] !== first[2]) nonEmpty += 1;
        }
      }
      return { found: true, width: rect.width, height: rect.height, glOk: Boolean(gl), variedPixels: nonEmpty };
    });
    if (!canvasInfo.found) failures.push(`${name}: no hay <canvas>`);
    else {
      if (!canvasInfo.glOk) failures.push(`${name}: canvas sin contexto WebGL`);
      if (canvasInfo.width < 200 || canvasInfo.height < 200) failures.push(`${name}: canvas demasiado pequeno (${canvasInfo.width}x${canvasInfo.height})`);
      if (canvasInfo.variedPixels === 0) failures.push(`${name}: canvas parece plano/blanco (0 pixeles con variacion)`);
      console.log(`  ${name}: canvas ${Math.round(canvasInfo.width)}x${Math.round(canvasInfo.height)}, webgl=${canvasInfo.glOk}, pixeles variados=${canvasInfo.variedPixels}`);
    }
  } else {
    // Dashboard clasico: verificar que cargo datos reales (algun valor numerico distinto de "--")
    const bodyText = await page.evaluate(() => document.body.innerText);
    if (!/\d+(\.\d+)?\s*(m\/s|RPM|°C|%|W|V)/i.test(bodyText)) {
      failures.push(`${name}: no se ven metricas con datos en la pagina`);
    } else {
      console.log(`  ${name}: metricas con datos visibles`);
    }
  }

  // Overlap visual: elementos visibles con texto que se solapan gravemente
  const overlaps = await page.evaluate(() => {
    const els = [...document.querySelectorAll("button, a, h1, h2, h3, p, span")].filter((el) => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 30 && r.height > 12 && style.visibility !== "hidden" && el.childElementCount === 0 && el.textContent.trim().length > 2;
    });
    const bad = [];
    for (let i = 0; i < els.length && bad.length < 5; i += 1) {
      for (let j = i + 1; j < els.length; j += 1) {
        if (els[i].contains(els[j]) || els[j].contains(els[i])) continue;
        const a = els[i].getBoundingClientRect();
        const b = els[j].getBoundingClientRect();
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        const overlapArea = x * y;
        const minArea = Math.min(a.width * a.height, b.width * b.height);
        if (minArea > 0 && overlapArea / minArea > 0.6) {
          bad.push(`${els[i].textContent.trim().slice(0, 25)} <-> ${els[j].textContent.trim().slice(0, 25)}`);
          break;
        }
      }
    }
    return bad;
  });
  if (overlaps.length > 0) failures.push(`${name}: posible overlap de texto: ${overlaps.join(" | ")}`);

  const shot = path.join(shotsDir, `${name}.png`);
  await page.screenshot({ path: shot, fullPage: !expect3d });
  console.log(`  ${name}: screenshot -> ${path.relative(root, shot)}`);

  const realErrors = consoleErrors.filter(
    (err) => !err.includes("favicon") && !err.includes("WebSocket") && !err.includes("Download the React DevTools"),
  );
  if (realErrors.length > 0) failures.push(`${name}: errores de consola: ${realErrors.slice(0, 3).join(" || ")}`);

  await context.close();
};

const run = async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  console.log("Verificando con Edge headless...");
  await checkPage(browser, { name: "overview-desktop", url: `${BASE}/`, viewport: { width: 1440, height: 900 } });
  await checkPage(browser, { name: "twin2d-desktop", url: `${BASE}/digital-twin`, viewport: { width: 1440, height: 900 } });
  await checkPage(browser, { name: "twin3d-desktop", url: `${BASE}/twin-3d`, viewport: { width: 1440, height: 900 }, expect3d: true });
  await checkPage(browser, { name: "twin3d-mobile", url: `${BASE}/twin-3d`, viewport: { width: 390, height: 844 }, isMobile: true, expect3d: true });
  await checkPage(browser, { name: "overview-mobile", url: `${BASE}/`, viewport: { width: 390, height: 844 }, isMobile: true });
  await browser.close();

  if (failures.length > 0) {
    console.error("\nFALLOS:");
    failures.forEach((failure) => console.error(` - ${failure}`));
    process.exit(1);
  }
  console.log("\nTodo OK: canvas 3D renderizando, datos cargados, sin errores de consola ni overlaps.");
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
