// Draws a GTA-style multi-panel poster cover onto a 2D canvas context.
// Every panel is a polygon (fractions of the cover width/height). Photos are
// cover-fit into their panel, then panned and zoomed. A colour grade, a
// vignette and a bold Anton caption finish the poster. All original work.

export const LAYOUTS = {
  // Hero on the left with a slanted right edge, two stacked panels on the right.
  vice: [
    [[0, 0], [0.60, 0], [0.54, 1], [0, 1]],
    [[0.60, 0], [1, 0], [1, 0.50], [0.57, 0.50]],
    [[0.57, 0.50], [1, 0.50], [1, 1], [0.54, 1]],
  ],
  // Two panels split by one diagonal.
  split: [
    [[0, 0], [0.56, 0], [0.50, 1], [0, 1]],
    [[0.56, 0], [1, 0], [1, 1], [0.50, 1]],
  ],
  // Four panels, the dividers tilted a little for the poster feel.
  quad: [
    [[0, 0], [0.52, 0], [0.49, 0.48], [0, 0.48]],
    [[0.52, 0], [1, 0], [1, 0.52], [0.49, 0.48]],
    [[0, 0.48], [0.49, 0.48], [0.47, 1], [0, 1]],
    [[0.49, 0.48], [1, 0.52], [1, 1], [0.47, 1]],
  ],
};

export const GRADES = ["sunset", "neon", "vice"];

/** Returns a fresh panel slot: no photo yet, no pan, no zoom. */
export function blankPanel() {
  return { photo: null, zoom: 1, panX: 0, panY: 0 };
}

/** Bounding box of a polygon, in absolute pixels. */
function panelBox(poly, w, h) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [fx, fy] of poly) {
    x0 = Math.min(x0, fx * w); y0 = Math.min(y0, fy * h);
    x1 = Math.max(x1, fx * w); y1 = Math.max(y1, fy * h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** True when point (x, y) lies inside the polygon (ray casting). */
function pointInPoly(x, y, poly, w, h) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0] * w, yi = poly[i][1] * h;
    const xj = poly[j][0] * w, yj = poly[j][1] * h;
    const crosses = (yi > y) !== (yj > y)
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Index of the panel containing (x, y), or -1 when the point is on a gutter. */
export function panelAt(x, y, w, h, layout) {
  const polys = LAYOUTS[layout] ?? LAYOUTS.vice;
  for (let i = polys.length - 1; i >= 0; i--) {
    if (pointInPoly(x, y, polys[i], w, h)) return i;
  }
  return -1;
}

/** Traces a polygon path on the context. */
function trace(ctx, poly, w, h) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0] * w, poly[0][1] * h);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * w, poly[i][1] * h);
  ctx.closePath();
}

/** Draws one panel's photo, cover-fit into the panel, then panned and zoomed. */
function drawPanelPhoto(ctx, poly, slot, w, h) {
  const box = panelBox(poly, w, h);
  ctx.save();
  trace(ctx, poly, w, h);
  ctx.clip();
  ctx.fillStyle = "#241a33";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  const photo = slot?.photo;
  if (photo && photo.naturalWidth > 0) {
    const base = Math.max(box.w / photo.naturalWidth, box.h / photo.naturalHeight);
    const scale = base * (slot.zoom || 1);
    const pw = photo.naturalWidth * scale;
    const ph = photo.naturalHeight * scale;
    const cx = box.x + box.w / 2 + (slot.panX || 0) * box.w;
    const cy = box.y + box.h / 2 + (slot.panY || 0) * box.h;
    ctx.drawImage(photo, cx - pw / 2, cy - ph / 2, pw, ph);
  } else {
    // Empty slot: a warm placeholder so the poster still reads as a poster.
    const g = ctx.createLinearGradient(box.x, box.y, box.x + box.w, box.y + box.h);
    g.addColorStop(0, "#3d2b5c");
    g.addColorStop(1, "#1c1230");
    ctx.fillStyle = g;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `${Math.max(14, box.w * 0.045)}px "Anton", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ADD PHOTO", box.x + box.w / 2, box.y + box.h / 2);
  }
  ctx.restore();
}

/** Washes the whole cover in the chosen colour grade, plus a vignette. */
function applyGrade(ctx, w, h, grade) {
  ctx.save();
  if (grade === "neon") {
    let g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, "rgba(255, 0, 140, 0.34)");
    g.addColorStop(0.55, "rgba(120, 0, 180, 0.10)");
    g.addColorStop(1, "rgba(0, 220, 255, 0.30)");
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "screen";
    g = ctx.createRadialGradient(w * 0.85, h * 0.12, 0, w * 0.85, h * 0.12, w * 0.45);
    g.addColorStop(0, "rgba(255, 0, 160, 0.30)");
    g.addColorStop(1, "rgba(255, 0, 160, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (grade === "vice") {
    let g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(0, 200, 210, 0.22)");
    g.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(255, 120, 40, 0.30)");
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else {
    // sunset (default): hot orange up top, magenta low down, purple at the foot.
    let g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, "rgba(255, 150, 60, 0.20)");
    g.addColorStop(0.45, "rgba(255, 80, 110, 0.16)");
    g.addColorStop(1, "rgba(110, 30, 160, 0.38)");
    ctx.globalCompositeOperation = "overlay";
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "screen";
    g = ctx.createRadialGradient(w * 0.72, h * 0.16, 0, w * 0.72, h * 0.16, w * 0.42);
    g.addColorStop(0, "rgba(255, 220, 140, 0.42)");
    g.addColorStop(0.5, "rgba(255, 140, 80, 0.16)");
    g.addColorStop(1, "rgba(255, 140, 80, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  // Vignette: darkens the corners so the caption band sits cleanly.
  ctx.globalCompositeOperation = "source-over";
  const v = ctx.createRadialGradient(
    w / 2, h / 2, Math.min(w, h) * 0.42,
    w / 2, h / 2, Math.max(w, h) * 0.75,
  );
  v.addColorStop(0, "rgba(0,0,0,0)");
  v.addColorStop(1, "rgba(5,0,15,0.42)");
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Draws the caption band: sub-caption, then the big title, slightly tilted. */
function drawCaption(ctx, w, h, caption, subcaption) {
  const band = ctx.createLinearGradient(0, h * 0.72, 0, h);
  band.addColorStop(0, "rgba(8, 3, 18, 0)");
  band.addColorStop(1, "rgba(8, 3, 18, 0.78)");
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.72, w, h * 0.28);

  const title = (caption || "").trim().toUpperCase();
  const sub = (subcaption || "").trim().toUpperCase();
  ctx.save();
  ctx.translate(w / 2, h * 0.90);
  ctx.rotate(-0.022);
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  if (sub) {
    const subSize = Math.max(12, h * 0.024);
    ctx.font = `400 ${subSize}px "Anton", sans-serif`;
    try { ctx.letterSpacing = `${Math.max(3, h * 0.006)}px`; } catch (_) { /* older canvas */ }
    ctx.fillStyle = "#ffd166";
    // Baseline well above the title's cap height, so the two never overlap.
    ctx.fillText(sub, 0, -h * 0.105);
    try { ctx.letterSpacing = "0px"; } catch (_) { /* older canvas */ }
  }
  if (title) {
    let size = h * 0.105;
    ctx.font = `400 ${size}px "Anton", sans-serif`;
    while (ctx.measureText(title).width > w * 0.92 && size > 14) {
      size -= 2;
      ctx.font = `400 ${size}px "Anton", sans-serif`;
    }
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(3, size * 0.10);
    ctx.strokeStyle = "#12061f";
    ctx.strokeText(title, 0, 0);
    ctx.shadowColor = "rgba(255, 46, 136, 0.85)";
    ctx.shadowBlur = size * 0.22;
    ctx.shadowOffsetY = size * 0.04;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(title, 0, 0);
  }
  ctx.restore();
}

/**
 * Draws the full cover. `state` holds layout, grade, caption, subcaption and
 * a panels array (one slot per panel of the layout). Works at any size.
 */
export function drawCoverArt(ctx, w, h, state) {
  const polys = LAYOUTS[state.layout] ?? LAYOUTS.vice;
  const gutter = Math.max(4, Math.round(w * 0.005));
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < polys.length; i++) {
    drawPanelPhoto(ctx, polys[i], state.panels[i], w, h);
  }
  // White gutters: a fat white stroke centred on every panel edge.
  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = gutter * 2;
  ctx.lineJoin = "round";
  for (const poly of polys) {
    trace(ctx, poly, w, h);
    ctx.stroke();
  }
  ctx.restore();
  applyGrade(ctx, w, h, state.grade || "sunset");
  drawCaption(ctx, w, h, state.caption, state.subcaption);
}
