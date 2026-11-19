// Wires the Vice Cover Studio page: photo uploads, panel picking, drag to pan,
// zoom, layout / grade / size pickers, PNG export, and a ?shot= mode that
// stages a fixed scene for screenshots. All original work.

import { LAYOUTS, GRADES, blankPanel, panelAt, drawCoverArt } from "./cover.js";

const canvas = document.getElementById("cover");
const status = document.getElementById("status");
const captionInput = document.getElementById("caption");
const subcaptionInput = document.getElementById("subcaption");
const zoomInput = document.getElementById("zoom");
const zoomVal = document.getElementById("zoomVal");

const SIZES = ["1080x1080", "1080x1350", "1920x1080"];

const state = {
  layout: "vice",
  grade: "sunset",
  caption: "Sunset Heist",
  subcaption: "Vice City · 2026",
  size: "1080x1080",
  panels: [blankPanel(), blankPanel(), blankPanel(), blankPanel()],
};
let selected = 0;

function sizeParts() {
  const [w, h] = state.size.split("x").map(Number);
  return { w, h };
}

function panelCount() {
  return (LAYOUTS[state.layout] ?? LAYOUTS.vice).length;
}

function currentPanel() {
  return state.panels[selected];
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

/** Redraws the preview canvas at the chosen export size. */
function redraw() {
  const { w, h } = sizeParts();
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  drawCoverArt(ctx, w, h, state);
  syncZoomControl();
}

function syncZoomControl() {
  const z = currentPanel().zoom || 1;
  zoomInput.value = String(z);
  zoomVal.textContent = `${z.toFixed(2)}×`;
}

function setStatus(text) {
  status.textContent = text;
}

/** Assigns a loaded photo to the selected panel (and redraws). */
function assignPhoto(img) {
  currentPanel().photo = img;
  redraw();
}

async function assignSample(name) {
  try {
    assignPhoto(await loadImage(`samples/${name}.jpg`));
    setStatus(`Loaded sample photo: ${name}.`);
  } catch (err) {
    setStatus(`Could not load the sample photo (${err.message}).`);
  }
}

// --- Photo controls ---------------------------------------------------------

document.getElementById("photo").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    assignPhoto(await loadImage(URL.createObjectURL(file)));
    setStatus(`Loaded ${file.name} into panel ${selected + 1}.`);
  } catch (err) {
    setStatus(`Could not read that file (${err.message}).`);
  }
  e.target.value = "";
});

document.getElementById("samplePier").addEventListener("click", () => assignSample("pier"));
document.getElementById("sampleBlvd").addEventListener("click", () => assignSample("boulevard"));

document.getElementById("fillAll").addEventListener("click", () => {
  const photo = currentPanel().photo;
  if (!photo) { setStatus("Pick a photo for this panel first."); return; }
  for (const slot of state.panels) slot.photo = photo;
  redraw();
  setStatus("One photo now fills every panel.");
});

document.getElementById("resetPanel").addEventListener("click", () => {
  const slot = currentPanel();
  slot.zoom = 1; slot.panX = 0; slot.panY = 0;
  redraw();
  setStatus(`Panel ${selected + 1} reset.`);
});

zoomInput.addEventListener("input", () => {
  currentPanel().zoom = Number(zoomInput.value);
  redraw();
});

// --- Caption and pickers ----------------------------------------------------

captionInput.addEventListener("input", () => { state.caption = captionInput.value; redraw(); });
subcaptionInput.addEventListener("input", () => { state.subcaption = subcaptionInput.value; redraw(); });

function wirePicker(id, attr, apply) {
  const group = document.getElementById(id);
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(`[data-${attr}]`);
    if (!btn) return;
    for (const b of group.querySelectorAll("button")) {
      b.classList.remove("picked");
      b.setAttribute("aria-pressed", "false");
    }
    btn.classList.add("picked");
    btn.setAttribute("aria-pressed", "true");
    apply(btn.dataset[attr]);
  });
}

wirePicker("layouts", "layout", (value) => {
  state.layout = value;
  if (selected >= panelCount()) selected = 0;
  redraw();
});
wirePicker("grades", "grade", (value) => { state.grade = value; redraw(); });
wirePicker("sizes", "size", (value) => { state.size = value; redraw(); });

// --- Drag to pan the photo inside its panel --------------------------------

let drag = null;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

canvas.addEventListener("pointerdown", (e) => {
  const p = canvasPoint(e);
  const hit = panelAt(p.x, p.y, canvas.width, canvas.height, state.layout);
  if (hit < 0) return;
  selected = hit;
  drag = { x: p.x, y: p.y, panX: currentPanel().panX, panY: currentPanel().panY };
  canvas.setPointerCapture(e.pointerId);
  syncZoomControl();
  redraw();
});

canvas.addEventListener("pointermove", (e) => {
  if (!drag) return;
  const p = canvasPoint(e);
  const slot = currentPanel();
  // Pan is a fraction of the cover, so it feels the same at every size.
  slot.panX = Math.max(-0.6, Math.min(0.6, drag.panX + (p.x - drag.x) / canvas.width));
  slot.panY = Math.max(-0.6, Math.min(0.6, drag.panY + (p.y - drag.y) / canvas.height));
  redraw();
});

for (const end of ["pointerup", "pointercancel"]) {
  canvas.addEventListener(end, () => { drag = null; });
}

// --- Export -----------------------------------------------------------------

document.getElementById("export").addEventListener("click", () => {
  const { w, h } = sizeParts();
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  drawCoverArt(off.getContext("2d"), w, h, state);
  off.toBlob((blob) => {
    if (!blob) { setStatus("Export failed: the browser could not make the PNG."); return; }
    const name = `vice-cover-${w}x${h}.png`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    setStatus(`Saved ${name} (${w} × ${h}).`);
  }, "image/png");
});

// --- Shot mode (fixed scenes for screenshots) -------------------------------

/**
 * Stages a screenshot scene from the query string:
 * ?shot=cover|editor &photo=pier|boulevard &caption=… &subcaption=… &layout=… &grade=… &size=WxH
 * The cover shot hides the editor chrome; the editor shot shows it with a photo
 * loaded. Sets window.__shotReady once the scene is painted.
 */
export async function runShot(query) {
  const shot = query.get("shot") || "editor";
  if (shot === "cover") document.body.classList.add("shot-cover");
  state.layout = query.get("layout") || "vice";
  if (GRADES.includes(query.get("grade"))) state.grade = query.get("grade");
  if (SIZES.includes(query.get("size"))) state.size = query.get("size");
  state.caption = query.get("caption") ?? state.caption;
  state.subcaption = query.get("subcaption") ?? state.subcaption;
  captionInput.value = state.caption;
  subcaptionInput.value = state.subcaption;
  // Reflect the chosen layout/grade/size in the picker buttons.
  for (const [id, attr, value] of [
    ["layouts", "layout", state.layout],
    ["grades", "grade", state.grade],
    ["sizes", "size", state.size],
  ]) {
    for (const b of document.querySelectorAll(`#${id} [data-${attr}]`)) {
      const on = b.dataset[attr] === value;
      b.classList.toggle("picked", on);
      b.setAttribute("aria-pressed", String(on));
    }
  }
  const photoName = query.get("photo") || "pier";
  const img = await loadImage(`samples/${photoName}.jpg`);
  for (const slot of state.panels) slot.photo = img;
  // A second sample in one panel makes the multi-photo story visible.
  try {
    const other = await loadImage(`samples/${photoName === "pier" ? "boulevard" : "pier"}.jpg`);
    if (panelCount() > 1) state.panels[1].photo = other;
  } catch (_) { /* one photo is enough */ }
  redraw();
  await document.fonts.ready;
  redraw();
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}

// --- Boot -------------------------------------------------------------------

async function boot() {
  const query = new URLSearchParams(location.search);
  if (query.get("shot")) {
    await runShot(query);
    return;
  }
  // Default scene: both samples loaded so the app reads as a cover at once.
  try {
    const pier = await loadImage("samples/pier.jpg");
    state.panels[0].photo = pier;
    const blvd = await loadImage("samples/boulevard.jpg");
    if (panelCount() > 1) state.panels[1].photo = blvd;
  } catch (_) { /* the user can upload instead */ }
  redraw();
  // Anton may arrive after the first paint; redraw once it is ready.
  if (document.fonts) {
    document.fonts.load('40px "Anton"').catch(() => {});
    document.fonts.ready.then(() => redraw()).catch(() => {});
  }
}

boot();
