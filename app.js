/* ================================================================
   SMART COLOR PALETTE GENERATOR — app.js  (v1.2)

   Fitur:
     1. Utilitas warna (HEX ↔ RGB ↔ HSL ↔ OKLCH)
     2. CIE76 Delta-E perceptual distance
     3. Style/Theme Selector + Undo History
     4. Copy Format Selector (HEX/RGB/HSL/OKLCH/EVE)
     5. Palette Lock per chip
     6. Color Harmony Mode (5 mode)
     7. Render chip + lock + copy + format
     8. Image-to-Palette + Bridge to Harmony
     9. Tri-Color Harmony (theme-aware, mode-aware)
    10. Surprise Me! (season × theme)
    11. Export modal (CSS/Tailwind/JSON/EVE/PNG)
    12. Dark Mode toggle
    13. Perceptual distance warning
================================================================ */

'use strict';

/* ═══════════════════════════════════════════════════════════
   § 1. WARNA UTILITIES
   ═══════════════════════════════════════════════════════════ */

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)];
}
function rgbToHex(r, g, b) {
  return '#' + [r,g,b].map(v => Math.round(clamp(v,0,255)).toString(16).padStart(2,'0')).join('');
}
function rgbToHsl(r, g, b) {
  r/=255; g/=255; b/=255;
  const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
  let h, s; const l=(mx+mn)/2;
  if(mx===mn){ h=s=0; } else {
    const d=mx-mn;
    s = l>0.5 ? d/(2-mx-mn) : d/(mx+mn);
    switch(mx){
      case r: h=((g-b)/d+(g<b?6:0))/6; break;
      case g: h=((b-r)/d+2)/6; break;
      default: h=((r-g)/d+4)/6; break;
    }
  }
  return [h*360, s, l];
}
function hslToRgb(h, s, l) {
  h/=360;
  const f=(p,q,t)=>{ if(t<0)t+=1; if(t>1)t-=1; if(t<1/6)return p+(q-p)*6*t; if(t<1/2)return q; if(t<2/3)return p+(q-p)*(2/3-t)*6; return p; };
  if(s===0){ const v=Math.round(l*255); return [v,v,v]; }
  const q=l<0.5 ? l*(1+s) : l+s-l*s, p=2*l-q;
  return [Math.round(f(p,q,h+1/3)*255), Math.round(f(p,q,h)*255), Math.round(f(p,q,h-1/3)*255)];
}
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

/* ── OKLCH approximation (via sRGB → linear → LCH-ish) ── */
function rgbToOklch(r, g, b) {
  // Simplified perceptual: use HSL as base, map to OKLCH-like output
  const [h, s, l] = rgbToHsl(r, g, b);
  // L ≈ perceived lightness (rough)
  const L = (0.299*r + 0.587*g + 0.114*b) / 255;
  // C ≈ chroma derived from saturation × lightness factor
  const C = s * 0.4 * (L > 0.5 ? (1 - L) : L) * 2;
  return [L, C, h];
}
function formatOklch(r, g, b) {
  const [L, C, h] = rgbToOklch(r, g, b);
  return `oklch(${L.toFixed(3)} ${C.toFixed(3)} ${Math.round(h)})`;
}

/* ═══════════════════════════════════════════════════════════
   § 2. PERCEPTUAL COLOR DISTANCE (CIE76 via Lab)
   ═══════════════════════════════════════════════════════════ */

/**
 * CIE76 Delta-E antara dua warna HEX.
 * Pipeline: sRGB → linearize → XYZ (D65) → CIE-Lab → ΔE
 *
 * Referensi:
 *   - sRGB → linear:  IEC 61966-2-1
 *   - XYZ D65 matrix: sRGB spec
 *   - XYZ → Lab:      CIE 1976
 */
function srgbToLinear(c) {
  c /= 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function labF(t) {
  return t > 0.008856 ? Math.cbrt(t) : (903.3 * t + 16) / 116;
}
function rgbToLab(r, g, b) {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  // sRGB → XYZ (D65)
  const x = (0.4124564*lr + 0.3575761*lg + 0.1804375*lb) / 0.95047;
  const y = (0.2126729*lr + 0.7151522*lg + 0.0721750*lb) / 1.0;
  const z = (0.0193339*lr + 0.1191920*lg + 0.9503041*lb) / 1.08883;
  const fx = labF(x), fy = labF(y), fz = labF(z);
  return [116*fy - 16, 500*(fx - fy), 200*(fy - fz)];
}
function deltaE(hex1, hex2) {
  const lab1 = rgbToLab(...hexToRgb(hex1));
  const lab2 = rgbToLab(...hexToRgb(hex2));
  return Math.sqrt(
    (lab1[0]-lab2[0])**2 +
    (lab1[1]-lab2[1])**2 +
    (lab1[2]-lab2[2])**2
  );
}

/**
 * Cek jarak antar warna palet, return pasangan terdekat jika ΔE < threshold.
 * @param {string[]} colors
 * @param {number} threshold (default 10)
 * @returns {{i:number, j:number, dE:number}|null}
 */
function findTooSimilar(colors, threshold = 10) {
  let minPair = null, minDE = Infinity;
  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const d = deltaE(colors[i], colors[j]);
      if (d < minDE) { minDE = d; minPair = { i, j, dE: d }; }
    }
  }
  return minDE < threshold ? minPair : null;
}

/* ═══════════════════════════════════════════════════════════
   § 3. FORMAT CONVERTER — untuk copy & export
   ═══════════════════════════════════════════════════════════ */

let copyFormat = 'hex'; // active copy format

/** Format satu warna HEX ke format target */
function formatColor(hex, fmt) {
  const [r, g, b] = hexToRgb(hex);
  switch (fmt) {
    case 'rgb':   return `rgb(${r}, ${g}, ${b})`;
    case 'hsl': {
      const [h, s, l] = rgbToHsl(r, g, b);
      return `hsl(${Math.round(h)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`;
    }
    case 'oklch': return formatOklch(r, g, b);
    case 'eve':   return hex.toUpperCase(); // EVE uses plain hex
    case 'hex':
    default:      return hex.toUpperCase();
  }
}

/**
 * Format array warna untuk EVE Online Theme/Palette Colors.
 * EVE menggunakan TEPAT 4 warna: "#00FF0A,#C000FF,#261E1E,#F2FF00"
 * Copy-paste langsung ke pengaturan theme di game.
 * Jika palet punya >4 warna, ambil 4 terbaik (distribusi hue paling jauh).
 * Jika <4 warna, gunakan seadanya.
 */
function formatEveOnline(hexArray) {
  // Ambil 4 warna: kalau pas 4, langsung. Kalau lebih, pilih 4 yang paling tersebar.
  let selected;
  if (hexArray.length <= 4) {
    selected = hexArray;
  } else if (hexArray.length === 5) {
    // Untuk palet 5 warna: ambil index [0,1,3,4] (skip bridge/netral tengah)
    // atau ambil 4 pertama. Strategi: buang yang paling mirip dengan tetangganya.
    let minDE = Infinity, dropIdx = 1;
    for (let i = 1; i < hexArray.length - 1; i++) {
      const d1 = deltaE(hexArray[i], hexArray[i-1]);
      const d2 = deltaE(hexArray[i], hexArray[i+1]);
      const avg = (d1 + d2) / 2;
      if (avg < minDE) { minDE = avg; dropIdx = i; }
    }
    selected = hexArray.filter((_, i) => i !== dropIdx);
  } else {
    selected = hexArray.slice(0, 4);
  }
  return selected.map(h => h.toUpperCase()).join(',');
}

/* Format pills event */
const formatPills = document.querySelectorAll('.fmt-pill');
formatPills.forEach(p => {
  p.addEventListener('click', () => {
    copyFormat = p.dataset.format;
    formatPills.forEach(q => { q.classList.remove('active'); q.setAttribute('aria-checked','false'); });
    p.classList.add('active');
    p.setAttribute('aria-checked','true');
    // Update existing chip labels
    updateAllChipLabels();
  });
});

/* ═══════════════════════════════════════════════════════════
   § 4. DARK MODE
   ═══════════════════════════════════════════════════════════ */

const darkToggle = document.getElementById('darkToggle');
let isDark = localStorage.getItem('scpg-dark') === 'true';

function applyDarkMode() {
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : '');
  darkToggle.textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('scpg-dark', isDark);
}
applyDarkMode();

darkToggle.addEventListener('click', () => {
  isDark = !isDark;
  applyDarkMode();
});

/* ═══════════════════════════════════════════════════════════
   § 5. THEME ENGINE + UNDO HISTORY
   ═══════════════════════════════════════════════════════════ */

const THEME_CONFIG = {
  dove:      { label:'Dove / Soft Pastel',  sMod:.45, lMod:1.15, hShift:0,  sCap:.38, sFloor:.05, lCap:.92, lFloor:.55 },
  neon:      { label:'Neon / Cyberpunk',    sMod:1.5, lMod:.95,  hShift:0,  sCap:1,   sFloor:.6,  lCap:.68, lFloor:.35 },
  vintage:   { label:'Vintage / Retro',     sMod:.55, lMod:.92,  hShift:-8, sCap:.5,  sFloor:.1,  lCap:.72, lFloor:.3 },
  minimalist:{ label:'Minimalist / Mono',   sMod:.15, lMod:1,    hShift:0,  sCap:.18, sFloor:0,   lCap:.95, lFloor:.15 }
};

let activeTheme = 'dove';
let themeHistory = []; // stack of previous theme keys
const MAX_HISTORY = 20;

function applyThemeColor(h, s, l, themeKey) {
  const t = THEME_CONFIG[themeKey];
  if (!t) return rgbToHex(...hslToRgb(h, s, l));
  const H = (h + t.hShift + 360) % 360;
  const S = clamp(s * t.sMod, t.sFloor, t.sCap);
  const L = clamp(l * t.lMod, t.lFloor, t.lCap);
  return rgbToHex(...hslToRgb(H, S, L));
}

function applyThemeToArray(hexArray, themeKey) {
  return hexArray.map(hex => {
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    return applyThemeColor(h, s, l, themeKey);
  });
}

const themePills = document.querySelectorAll('.pill');
const btnUndo = document.getElementById('btnUndo');

themePills.forEach(pill => {
  pill.addEventListener('click', () => {
    const newTheme = pill.dataset.theme;
    if (newTheme === activeTheme) return;
    // Push current to history
    themeHistory.push(activeTheme);
    if (themeHistory.length > MAX_HISTORY) themeHistory.shift();
    activeTheme = newTheme;
    updateThemeUI();
    regenerateAllPalettes();
  });
});

btnUndo.addEventListener('click', () => {
  if (themeHistory.length === 0) return;
  activeTheme = themeHistory.pop();
  updateThemeUI();
  regenerateAllPalettes();
});

function updateThemeUI() {
  themePills.forEach(p => {
    const isActive = p.dataset.theme === activeTheme;
    p.classList.toggle('active', isActive);
    p.setAttribute('aria-checked', isActive ? 'true' : 'false');
  });
  btnUndo.disabled = themeHistory.length === 0;
}

/* ═══════════════════════════════════════════════════════════
   § 6. COLOR HARMONY MODES
   ═══════════════════════════════════════════════════════════ */

let harmonyMode = 'complementary';

const harmonyModePills = document.querySelectorAll('.hm-pill');
harmonyModePills.forEach(p => {
  p.addEventListener('click', () => {
    harmonyMode = p.dataset.mode;
    harmonyModePills.forEach(q => { q.classList.remove('active'); q.setAttribute('aria-checked','false'); });
    p.classList.add('active');
    p.setAttribute('aria-checked','true');
  });
});

/**
 * Hitung 2 hue tambahan berdasarkan mode harmoni.
 *
 * @param {number} baseH - Hue rata-rata dari 3 input (0–360)
 * @param {string} mode  - complementary|analogous|triadic|split|tetradic
 * @returns {[number, number]} dua hue baru
 */
function getHarmonyHues(baseH, mode) {
  switch (mode) {
    case 'complementary':
      return [(baseH + 180) % 360, (baseH + 160) % 360];
    case 'analogous':
      return [(baseH + 30) % 360, (baseH - 30 + 360) % 360];
    case 'triadic':
      return [(baseH + 120) % 360, (baseH + 240) % 360];
    case 'split':
      return [(baseH + 150) % 360, (baseH + 210) % 360];
    case 'tetradic':
      return [(baseH + 90) % 360, (baseH + 270) % 360];
    default:
      return [(baseH + 180) % 360, (baseH + 160) % 360];
  }
}

/* ═══════════════════════════════════════════════════════════
   § 7. PALETTE LOCK — per-chip locking
   ═══════════════════════════════════════════════════════════ */

// Map: containerId → { index: hex }
const lockedColors = {
  imgPalette: {},
  harmonyPalette: {},
  surprisePalette: {}
};

function getEffectiveColors(containerId, baseArray) {
  const locks = lockedColors[containerId] || {};
  return baseArray.map((hex, i) => locks[i] !== undefined ? locks[i] : hex);
}

/* ═══════════════════════════════════════════════════════════
   § 8. RENDER COLOR CHIPS + LOCK + FORMAT
   ═══════════════════════════════════════════════════════════ */

/** Referensi semua container yang aktif (untuk update label saat format berganti) */
const activeContainers = new Set();

function renderPalette(hexColors, container) {
  container.innerHTML = '';
  activeContainers.add(container);
  const containerId = container.id;
  const locks = lockedColors[containerId] || {};

  hexColors.forEach((hex, idx) => {
    const chip = document.createElement('div');
    chip.className = 'color-chip' + (locks[idx] !== undefined ? ' locked' : '');
    chip.style.background = hex;
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.title = `Klik untuk salin ${formatColor(hex, copyFormat)}`;

    // Lock button
    const lockBtn = document.createElement('button');
    lockBtn.className = 'chip-lock';
    lockBtn.textContent = locks[idx] !== undefined ? '🔒' : '🔓';
    lockBtn.title = locks[idx] !== undefined ? 'Unlock warna ini' : 'Lock warna ini';
    lockBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (lockedColors[containerId][idx] !== undefined) {
        delete lockedColors[containerId][idx];
        chip.classList.remove('locked');
        lockBtn.textContent = '🔓';
      } else {
        lockedColors[containerId][idx] = hex;
        chip.classList.add('locked');
        lockBtn.textContent = '🔒';
      }
    });

    // HEX label
    const label = document.createElement('span');
    label.className = 'chip-hex';
    label.textContent = formatColor(hex, copyFormat);
    label.dataset.hex = hex; // store raw hex for format switching

    // Copied overlay
    const copied = document.createElement('span');
    copied.className = 'chip-copied';
    copied.textContent = 'COPIED!';

    chip.appendChild(lockBtn);
    chip.appendChild(label);
    chip.appendChild(copied);

    const doCopy = () => {
      const text = copyFormat === 'eve'
        ? formatEveOnline(hexColors)
        : formatColor(hex, copyFormat);
      navigator.clipboard.writeText(text).then(() => {
        copied.textContent = copyFormat === 'eve' ? 'EVE COPIED!' : 'COPIED!';
        copied.classList.add('show');
        setTimeout(() => copied.classList.remove('show'), 1200);
      });
    };
    chip.addEventListener('click', doCopy);
    chip.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') doCopy(); });

    container.appendChild(chip);
  });

  container.classList.remove('hidden');
}

/** Update semua chip labels saat format berubah */
function updateAllChipLabels() {
  activeContainers.forEach(container => {
    container.querySelectorAll('.color-chip').forEach(chip => {
      const label = chip.querySelector('.chip-hex');
      if (label && label.dataset.hex) {
        label.textContent = formatColor(label.dataset.hex, copyFormat);
      }
      chip.title = `Klik untuk salin ${label ? label.textContent : ''}`;
    });
  });
}

/* ═══════════════════════════════════════════════════════════
   § 9. DISTANCE WARNING — cek dan tampilkan peringatan
   ═══════════════════════════════════════════════════════════ */

function checkDistance(colors, warnEl) {
  if (!warnEl) return;
  const result = findTooSimilar(colors, 10);
  if (result) {
    warnEl.innerHTML = `⚠️ Warna ${result.i+1} & ${result.j+1} terlalu mirip (ΔE=${result.dE.toFixed(1)}). Beberapa warna mungkin sulit dibedakan.`;
    warnEl.classList.remove('hidden');
  } else {
    warnEl.classList.add('hidden');
  }
}

/* ═══════════════════════════════════════════════════════════
   § 10. IMAGE-TO-PALETTE + BRIDGE
   ═══════════════════════════════════════════════════════════ */

const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const imgPreview     = document.getElementById('imgPreview');
const previewWrap    = document.getElementById('img-preview-wrap');
const btnClearImg    = document.getElementById('btnClearImg');
const imgPlaceholder = document.getElementById('imgPlaceholder');
const imgPalette     = document.getElementById('imgPalette');
const imgDistWarn    = document.getElementById('imgDistWarn');
const btnImgToHarmony= document.getElementById('btnImgToHarmony');
const btnImgExport   = document.getElementById('btnImgExport');

const colorThief = new ColorThief();
let imgExtractedColors = null;

function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => {
    imgPreview.src = e.target.result;
    previewWrap.style.display = 'block';
    imgPalette.classList.add('hidden');
    imgPlaceholder.style.display = 'flex';
    btnImgToHarmony.style.display = 'none';
    btnImgExport.style.display = 'none';

    imgPreview.onload = () => {
      try {
        const rawPalette = colorThief.getPalette(imgPreview, 5, 1);
        imgExtractedColors = rawPalette.map(([r,g,b]) => rgbToHex(r,g,b));
        imgPlaceholder.style.display = 'none';
        const themed = applyThemeToArray(imgExtractedColors, activeTheme);
        renderPalette(themed, imgPalette);
        checkDistance(themed, imgDistWarn);
        btnImgToHarmony.style.display = 'block';
        btnImgExport.style.display = 'flex';
      } catch (err) {
        imgPlaceholder.style.display = 'none';
        console.error('ColorThief error:', err);
        alert('Gagal mengekstrak warna. Pastikan gambar valid.');
      }
    };
    imgPreview.onerror = () => { imgPlaceholder.style.display = 'none'; alert('Gagal memuat gambar.'); };
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', e => { if(e.target.files[0]) handleImageFile(e.target.files[0]); });
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  if(e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
});
btnClearImg.addEventListener('click', () => {
  imgPreview.src = ''; previewWrap.style.display = 'none';
  imgPalette.classList.add('hidden'); imgExtractedColors = null;
  fileInput.value = ''; btnImgToHarmony.style.display = 'none';
  btnImgExport.style.display = 'none'; imgDistWarn.classList.add('hidden');
  delete lockedColors.imgPalette;
});

// Bridge: image top 3 → harmony pickers
btnImgToHarmony.addEventListener('click', () => {
  if (!imgExtractedColors || imgExtractedColors.length < 3) return;
  document.getElementById('c1').value = imgExtractedColors[0];
  document.getElementById('c2').value = imgExtractedColors[1];
  document.getElementById('c3').value = imgExtractedColors[2];
  // Scroll ke harmony section & auto-generate
  document.getElementById('sec-harmony').scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => btnHarmony.click(), 400);
});

/* ═══════════════════════════════════════════════════════════
   § 11. TRI-COLOR HARMONY (mode + theme aware)
   ═══════════════════════════════════════════════════════════ */

const btnHarmony     = document.getElementById('btnHarmony');
const harmonyPalette = document.getElementById('harmonyPalette');
const harmonyDistWarn= document.getElementById('harmonyDistWarn');
const btnHarmonyExport = document.getElementById('btnHarmonyExport');

let harmonyBaseColors = null;

/**
 * Generate 5-warna palet dari 3 input + harmony mode + tema.
 *
 * Alur:
 *   1. 3 input = warna 1, 2, 3
 *   2. Hitung rata-rata hue dari ketiga input
 *   3. Dari mode harmoni, dapat 2 hue baru → bangun warna 4 & 5
 *   4. Terapkan tema pada seluruh palet
 */
function generateHarmony(hex1, hex2, hex3) {
  const [h1,s1,l1] = rgbToHsl(...hexToRgb(hex1));
  const [h2,s2,l2] = rgbToHsl(...hexToRgb(hex2));
  const [h3,s3,l3] = rgbToHsl(...hexToRgb(hex3));

  const avgH = (h1 + h2 + h3) / 3;
  const avgS = (s1 + s2 + s3) / 3;
  const avgL = (l1 + l2 + l3) / 3;

  const [newH1, newH2] = getHarmonyHues(avgH, harmonyMode);

  // Warna 4: berdasarkan harmony hue pertama, saturasi & lightness rata-rata
  const w4S = clamp(avgS * 0.8, 0.15, 0.65);
  const w4L = clamp(avgL * 1.1, 0.55, 0.88);
  const w4 = rgbToHex(...hslToRgb(newH1, w4S, w4L));

  // Warna 5: berdasarkan harmony hue kedua, tone lebih gelap
  const w5S = clamp(avgS * 0.7, 0.12, 0.55);
  const w5L = clamp(avgL * 0.65, 0.18, 0.45);
  const w5 = rgbToHex(...hslToRgb(newH2, w5S, w5L));

  // Respect locks
  harmonyBaseColors = getEffectiveColors('harmonyPalette', [hex1, hex2, hex3, w4, w5]);

  const themed = applyThemeToArray(harmonyBaseColors, activeTheme);
  checkDistance(themed, harmonyDistWarn);
  btnHarmonyExport.style.display = 'flex';
  return themed;
}

btnHarmony.addEventListener('click', () => {
  const c1 = document.getElementById('c1').value;
  const c2 = document.getElementById('c2').value;
  const c3 = document.getElementById('c3').value;
  renderPalette(generateHarmony(c1,c2,c3), harmonyPalette);
});

/* ═══════════════════════════════════════════════════════════
   § 12. SURPRISE ME! (season × theme)
   ═══════════════════════════════════════════════════════════ */

const btnSurprise     = document.getElementById('btnSurprise');
const surprisePalette = document.getElementById('surprisePalette');
const seasonBadge     = document.getElementById('seasonBadge');
const surpriseDesc    = document.getElementById('surpriseDesc');
const surpriseDistWarn= document.getElementById('surpriseDistWarn');
const btnSurpriseExport = document.getElementById('btnSurpriseExport');

let surpriseBaseColors = null;

const SEASON_DATA = {
  winter_early: {
    name:'Cool Winter', emoji:'❄️',
    desc:'Nuansa biru dingin, abu slate, dan aksen putih bersih.',
    palettes:[
      [[210,55,88],[218,40,72],[220,30,52],[215,20,35],[200,15,22]],
      [[195,60,85],[205,45,68],[210,35,48],[220,25,30],[195,10,18]]
    ]
  },
  spring: {
    name:'Fresh Spring', emoji:'🌸',
    desc:'Hijau muda, merah muda lembut, dan kuning krem — segar.',
    palettes:[
      [[120,42,82],[350,45,80],[50,60,88],[140,30,65],[350,20,45]],
      [[100,38,78],[330,40,82],[55,55,84],[125,25,60],[340,18,48]]
    ]
  },
  summer_early: {
    name:'Golden Summer', emoji:'☀️',
    desc:'Oranye matang, kuning cerah, dan koral tropis.',
    palettes:[
      [[38,88,62],[22,78,58],[50,90,68],[15,70,52],[200,45,40]],
      [[42,82,65],[28,75,60],[55,85,70],[18,65,50],[210,40,38]]
    ]
  },
  summer_peak: {
    name:'Peak Summer', emoji:'🏖️',
    desc:'Biru lautan, putih pasir, merah terakota — vibrant.',
    palettes:[
      [[200,65,55],[45,70,75],[20,60,58],[180,40,62],[200,20,30]],
      [[195,58,52],[48,65,78],[25,55,55],[175,35,60],[205,18,28]]
    ]
  },
  autumn: {
    name:'Rich Autumn', emoji:'🍂',
    desc:'Coklat kayu, oranye tembaga, dan kuning tua — hangat.',
    palettes:[
      [[30,65,45],[20,70,52],[40,58,60],[15,50,38],[35,25,25]],
      [[28,60,48],[18,65,50],[38,55,62],[12,48,35],[32,22,22]]
    ]
  },
  winter_late: {
    name:'Dark Elegance', emoji:'🌙',
    desc:'Navy malam, emas hangat, dan krim pucat — mewah.',
    palettes:[
      [[220,45,28],[42,65,52],[50,50,82],[200,30,20],[40,20,70]],
      [[215,40,25],[45,60,50],[48,48,80],[205,28,18],[38,18,68]]
    ]
  }
};

function getSeason(month) {
  if(month<=2) return 'winter_early';
  if(month<=4) return 'spring';
  if(month<=6) return 'summer_early';
  if(month<=8) return 'summer_peak';
  if(month<=10) return 'autumn';
  return 'winter_late';
}

function generateSeasonalPalette() {
  const month = new Date().getMonth()+1;
  const season = getSeason(month);
  const data = SEASON_DATA[season];
  const base = data.palettes[Math.floor(Math.random()*data.palettes.length)];

  const jitter = (v,r) => clamp(v+(Math.random()*r*2-r), 0, 100);

  // Generate base (pre-theme), respecting locks
  let raw = base.map(([h,s,l]) => {
    const H=(h+(Math.random()*14-7)+360)%360;
    const S=jitter(s,6)/100;
    const L=jitter(l,5)/100;
    return rgbToHex(...hslToRgb(H,S,L));
  });
  surpriseBaseColors = getEffectiveColors('surprisePalette', raw);

  seasonBadge.textContent = `${data.emoji} ${data.name}`;
  surpriseDesc.textContent = data.desc;

  const themed = applyThemeToArray(surpriseBaseColors, activeTheme);
  checkDistance(themed, surpriseDistWarn);
  btnSurpriseExport.style.display = 'flex';
  return themed;
}

function initSeasonBadge() {
  const m = new Date().getMonth()+1;
  const d = SEASON_DATA[getSeason(m)];
  seasonBadge.textContent = `${d.emoji} ${d.name}`;
  surpriseDesc.textContent = d.desc;
}

btnSurprise.addEventListener('click', () => {
  renderPalette(generateSeasonalPalette(), surprisePalette);
});

/* ═══════════════════════════════════════════════════════════
   § 13. RE-GENERATE ALL (saat tema / lock berubah)
   ═══════════════════════════════════════════════════════════ */

function regenerateAllPalettes() {
  if (imgExtractedColors && !imgPalette.classList.contains('hidden')) {
    const themed = applyThemeToArray(imgExtractedColors, activeTheme);
    renderPalette(themed, imgPalette);
    checkDistance(themed, imgDistWarn);
  }
  if (harmonyBaseColors && !harmonyPalette.classList.contains('hidden')) {
    const themed = applyThemeToArray(harmonyBaseColors, activeTheme);
    renderPalette(themed, harmonyPalette);
    checkDistance(themed, harmonyDistWarn);
  }
  if (!surprisePalette.classList.contains('hidden')) {
    renderPalette(generateSeasonalPalette(), surprisePalette);
  }
}

/* ═══════════════════════════════════════════════════════════
   § 14. EXPORT MODAL
   ═══════════════════════════════════════════════════════════ */

const exportModal       = document.getElementById('exportModal');
const modalClose        = document.getElementById('modalClose');
const exportChips       = document.getElementById('exportChips');
const exportCode        = document.getElementById('exportCode');
const exportTabs        = document.querySelectorAll('.export-tab');
const btnCopyExport     = document.getElementById('btnCopyExport');
const btnDownloadExport = document.getElementById('btnDownloadExport');

let currentExportColors = [];
let currentExportFormat = 'css';

function openExportModal(colors) {
  currentExportColors = colors;
  // Preview chips
  exportChips.innerHTML = '';
  colors.forEach(c => {
    const d = document.createElement('div');
    d.className = 'export-chip-preview';
    d.style.background = c;
    exportChips.appendChild(d);
  });
  // Default tab
  currentExportFormat = 'css';
  exportTabs.forEach(t => t.classList.toggle('active', t.dataset.exp === 'css'));
  renderExportCode();
  exportModal.classList.remove('hidden');
}

function renderExportCode() {
  const c = currentExportColors;
  let code = '';
  let showDownload = false;

  // Untuk EVE: tampilkan hanya 4 chip preview
  if (currentExportFormat === 'eve') {
    const eveColors = c.length <= 4 ? c : (() => {
      if (c.length === 5) {
        let minDE = Infinity, dropIdx = 1;
        for (let i = 1; i < c.length - 1; i++) {
          const d1 = deltaE(c[i], c[i-1]), d2 = deltaE(c[i], c[i+1]);
          const avg = (d1+d2)/2;
          if (avg < minDE) { minDE = avg; dropIdx = i; }
        }
        return c.filter((_,i) => i !== dropIdx);
      }
      return c.slice(0,4);
    })();
    exportChips.innerHTML = '';
    eveColors.forEach(col => {
      const d = document.createElement('div');
      d.className = 'export-chip-preview';
      d.style.background = col;
      exportChips.appendChild(d);
    });
    // Tambah label "4 warna"
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:11px;color:var(--text-sub);align-self:center;margin-left:4px;';
    lbl.textContent = '(4 warna EVE)';
    exportChips.appendChild(lbl);
  } else {
    // Restore semua chip untuk format lain
    exportChips.innerHTML = '';
    c.forEach(col => {
      const d = document.createElement('div');
      d.className = 'export-chip-preview';
      d.style.background = col;
      exportChips.appendChild(d);
    });
  }

  switch (currentExportFormat) {
    case 'css':
      code = ':root {\n' + c.map((h,i) => `  --palette-${i+1}: ${h};`).join('\n') + '\n}';
      break;
    case 'tailwind':
      code = 'module.exports = {\n  theme: {\n    extend: {\n      colors: {\n        palette: {\n'
        + c.map((h,i) => `          '${i+1}': '${h}',`).join('\n')
        + '\n        }\n      }\n    }\n  }\n}';
      break;
    case 'json':
      code = JSON.stringify({ palette: c }, null, 2);
      break;
    case 'eve': {
      const eveStr = formatEveOnline(c);
      const eveColors = c.length <= 4 ? c : (() => {
        if (c.length === 5) {
          let minDE = Infinity, dropIdx = 1;
          for (let i = 1; i < c.length - 1; i++) {
            const d1 = deltaE(c[i], c[i-1]), d2 = deltaE(c[i], c[i+1]);
            const avg = (d1+d2)/2;
            if (avg < minDE) { minDE = avg; dropIdx = i; }
          }
          return c.filter((_,i) => i !== dropIdx);
        }
        return c.slice(0,4);
      })();
      code = eveStr
        + '\n\n// EVE Online - Theme Palette (4 warna)'
        + '\n// Copy string di atas, paste langsung ke Settings > Color Theme'
        + '\n//'
        + '\n// Warna 1 (Primary)   : ' + eveColors[0]
        + '\n// Warna 2 (Secondary) : ' + eveColors[1]
        + '\n// Warna 3 (Detail)    : ' + eveColors[2]
        + '\n// Warna 4 (Accent)    : ' + eveColors[3];
      break;
    }
    case 'png':
      code = '// Klik "Download" untuk menyimpan palet sebagai gambar PNG 800×200px';
      showDownload = true;
      break;
  }
  exportCode.textContent = code;
  btnDownloadExport.style.display = showDownload ? 'inline-flex' : 'none';
}

exportTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    currentExportFormat = tab.dataset.exp;
    exportTabs.forEach(t => t.classList.toggle('active', t === tab));
    renderExportCode();
  });
});

btnCopyExport.addEventListener('click', () => {
  navigator.clipboard.writeText(exportCode.textContent).then(() => {
    btnCopyExport.textContent = '✅ Copied!';
    setTimeout(() => btnCopyExport.textContent = '📋 Copy', 1500);
  });
});

// PNG download
btnDownloadExport.addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800; canvas.height = 200;
  const ctx = canvas.getContext('2d');
  const w = 800 / currentExportColors.length;
  currentExportColors.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(i * w, 0, w, 200);
    // Label
    ctx.fillStyle = '#fff';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    const rgb = hexToRgb(c);
    const lum = 0.299*rgb[0] + 0.587*rgb[1] + 0.114*rgb[2];
    ctx.fillStyle = lum > 128 ? '#1C1917' : '#FFFFFF';
    ctx.fillText(c.toUpperCase(), i*w + w/2, 110);
  });
  const link = document.createElement('a');
  link.download = 'palette.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
});

modalClose.addEventListener('click', () => exportModal.classList.add('hidden'));
exportModal.addEventListener('click', e => {
  if (e.target === exportModal) exportModal.classList.add('hidden');
});

// Export button handlers
btnImgExport.addEventListener('click', () => {
  if (imgExtractedColors) openExportModal(applyThemeToArray(imgExtractedColors, activeTheme));
});
btnHarmonyExport.addEventListener('click', () => {
  if (harmonyBaseColors) openExportModal(applyThemeToArray(harmonyBaseColors, activeTheme));
});
btnSurpriseExport.addEventListener('click', () => {
  if (surpriseBaseColors) openExportModal(applyThemeToArray(surpriseBaseColors, activeTheme));
});

/* ═══════════════════════════════════════════════════════════
   § 15. INIT — DOM ready
   ═══════════════════════════════════════════════════════════ */

window.addEventListener('DOMContentLoaded', () => {
  // Harmony defaults
  renderPalette(generateHarmony('#E07B54','#4A90D9','#7BC67E'), harmonyPalette);
  // Surprise init
  initSeasonBadge();
  renderPalette(generateSeasonalPalette(), surprisePalette);
});

/* ═══════════════════════════════════════════════════════════
   § 16. COPYRIGHT FOOTER
   ═══════════════════════════════════════════════════════════ */
const copyrightEl = document.getElementById('copyright-text');
if (copyrightEl) {
  copyrightEl.textContent = `© ${new Date().getFullYear()} KingSyah`;
}
