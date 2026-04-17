/* ================================================================
   SMART COLOR PALETTE GENERATOR — app.js

   Logika aplikasi:
     1. Utilitas konversi warna (HEX ↔ RGB ↔ HSL)
     2. Style/Theme Selector — state & pengaruh pada palet
     3. Render color chips + copy-to-clipboard
     4. Section 1: Image-to-Palette (Color Thief)
     5. Section 2: Tri-Color Harmony (5 warna, theme-aware)
     6. Section 3: Surprise Me! (musim × tema)
     7. Footer copyright
================================================================ */

'use strict';

/* ----------------------------------------------------------------
   UTILITAS WARNA — konversi dan kalkulasi
---------------------------------------------------------------- */

/** HEX string → [r, g, b] (nilai 0–255) */
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16)
  ];
}

/** [r, g, b] → HEX string */
function rgbToHex(r, g, b) {
  return '#' + [r, g, b]
    .map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0'))
    .join('');
}

/** [r, g, b] (0–255) → [h (0–360), s (0–1), l (0–1)] */
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s, l];
}

/** [h (0–360), s (0–1), l (0–1)] → [r, g, b] (0–255) */
function hslToRgb(h, s, l) {
  h /= 360;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255)
  ];
}

/** Clamp value ke rentang [min, max] */
function clamp(v, mn, mx) {
  return Math.max(mn, Math.min(mx, v));
}

/* ================================================================
   STYLE / THEME SELECTOR — state & modifier engine
================================================================ */

/**
 * Definisi tema. Setiap tema punya modifier HSL yang diterapkan
 * pada warna yang di-generate (baik dari harmony maupun surprise).
 *
 * Key:
 *   sMod  : multiplier saturasi (1.0 = tidak berubah)
 *   lMod  : multiplier lightness (1.0 = tidak berubah)
 *   hShift: derajat pergeseran hue (0 = tidak bergeser)
 *   sCap  : batas atas saturasi (0–1)
 *   sFloor: batas bawah saturasi (0–1)
 *   lCap  : batas atas lightness (0–1)
 *   lFloor: batas bawah lightness (0–1)
 */
const THEME_CONFIG = {
  dove: {
    label: 'Dove / Soft Pastel',
    sMod: 0.45,    // turunkan saturasi drastis → lembut & muted
    lMod: 1.15,    // naikkan lightness → pastel
    hShift: 0,
    sCap: 0.38,
    sFloor: 0.05,
    lCap: 0.92,
    lFloor: 0.55
  },
  neon: {
    label: 'Neon / Cyberpunk',
    sMod: 1.5,     // naikkan saturasi → vibrance tinggi
    lMod: 0.95,    // sedikit gelapkan untuk kontras neon
    hShift: 0,
    sCap: 1.0,
    sFloor: 0.6,
    lCap: 0.68,
    lFloor: 0.35
  },
  vintage: {
    label: 'Vintage / Retro',
    sMod: 0.55,    // kurangi saturasi → desaturated earth tones
    lMod: 0.92,    // sedikit redupkan
    hShift: -8,    // geser hue sedikit ke warm
    sCap: 0.5,
    sFloor: 0.1,
    lCap: 0.72,
    lFloor: 0.3
  },
  minimalist: {
    label: 'Minimalist / Monochrome',
    sMod: 0.15,    // hampir grayscale
    lMod: 1.0,
    hShift: 0,
    sCap: 0.18,
    sFloor: 0.0,
    lCap: 0.95,
    lFloor: 0.15
  }
};

/** Tema aktif saat ini (default: dove) */
let activeTheme = 'dove';

/**
 * Terapkan modifier tema pada satu warna HSL.
 *
 * @param {number} h - Hue 0–360
 * @param {number} s - Saturation 0–1
 * @param {number} l - Lightness 0–1
 * @param {string} themeKey - Key dari THEME_CONFIG
 * @returns {string} HEX string warna yang sudah dimodifikasi
 */
function applyTheme(h, s, l, themeKey) {
  const t = THEME_CONFIG[themeKey];
  if (!t) return rgbToHex(...hslToRgb(h, s, l));

  // Geser hue
  let H = (h + t.hShift + 360) % 360;

  // Modifikasi saturasi & lightness, lalu clamp ke batas tema
  let S = clamp(s * t.sMod, t.sFloor, t.sCap);
  let L = clamp(l * t.lMod, t.lFloor, t.lCap);

  return rgbToHex(...hslToRgb(H, S, L));
}

/**
 * Terapkan tema pada array HEX — mengembalikan array baru.
 * @param {string[]} hexArray
 * @param {string} themeKey
 * @returns {string[]}
 */
function applyThemeToArray(hexArray, themeKey) {
  return hexArray.map(hex => {
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    return applyTheme(h, s, l, themeKey);
  });
}

// ── Theme pill UI ──
const themePills = document.querySelectorAll('.pill');
themePills.forEach(pill => {
  pill.addEventListener('click', () => {
    // Update state
    activeTheme = pill.dataset.theme;
    // Update UI active class
    themePills.forEach(p => {
      p.classList.remove('active');
      p.setAttribute('aria-checked', 'false');
    });
    pill.classList.add('active');
    pill.setAttribute('aria-checked', 'true');
    // Regenerate semua palet yang sudah pernah dibuat
    regenerateAllPalettes();
  });
});

/* ================================================================
   RENDER COLOR CHIPS — buat elemen kotak warna + copy HEX
================================================================ */

/**
 * Merender array hex ke dalam container sebagai color chips.
 * Setiap chip bisa diklik untuk menyalin kode HEX ke clipboard.
 *
 * @param {string[]} hexColors - Array kode HEX
 * @param {HTMLElement} container - Elemen target
 */
function renderPalette(hexColors, container) {
  container.innerHTML = '';

  hexColors.forEach(hex => {
    const chip = document.createElement('div');
    chip.className = 'color-chip';
    chip.style.background = hex;
    chip.setAttribute('role', 'button');
    chip.setAttribute('tabindex', '0');
    chip.setAttribute('aria-label', `Copy ${hex}`);
    chip.title = `Klik untuk salin ${hex}`;

    const label = document.createElement('span');
    label.className = 'chip-hex';
    label.textContent = hex.toUpperCase();

    const copied = document.createElement('span');
    copied.className = 'chip-copied';
    copied.textContent = 'COPIED!';

    chip.appendChild(label);
    chip.appendChild(copied);

    const doCopy = () => {
      navigator.clipboard.writeText(hex.toUpperCase()).then(() => {
        copied.classList.add('show');
        setTimeout(() => copied.classList.remove('show'), 1200);
      });
    };
    chip.addEventListener('click', doCopy);
    chip.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') doCopy();
    });

    container.appendChild(chip);
  });

  container.classList.remove('hidden');
}

/* ================================================================
   SECTION 1 — IMAGE-TO-PALETTE
================================================================ */

const dropZone       = document.getElementById('dropZone');
const fileInput      = document.getElementById('fileInput');
const imgPreview     = document.getElementById('imgPreview');
const previewWrap    = document.getElementById('img-preview-wrap');
const btnClearImg    = document.getElementById('btnClearImg');
const imgPlaceholder = document.getElementById('imgPlaceholder');
const imgPalette     = document.getElementById('imgPalette');

// Inisialisasi Color Thief
const colorThief = new ColorThief();

/** Simpan warna hasil ekstraksi (HEX) agar bisa di-re-theme */
let imgExtractedColors = null;

/**
 * Memproses file gambar: baca preview → ekstrak 5 warna dominan.
 */
function handleImageFile(file) {
  if (!file || !file.type.startsWith('image/')) return;

  const reader = new FileReader();
  reader.onload = e => {
    imgPreview.src = e.target.result;
    previewWrap.style.display = 'block';
    imgPalette.classList.add('hidden');
    imgPlaceholder.style.display = 'flex';

    imgPreview.onload = () => {
      try {
        const rawPalette = colorThief.getPalette(imgPreview, 5, 1);
        imgExtractedColors = rawPalette.map(([r, g, b]) => rgbToHex(r, g, b));
        imgPlaceholder.style.display = 'none';
        // Terapkan tema aktif sebelum render
        renderPalette(applyThemeToArray(imgExtractedColors, activeTheme), imgPalette);
      } catch (err) {
        imgPlaceholder.style.display = 'none';
        console.error('ColorThief error:', err);
        alert('Gagal mengekstrak warna. Pastikan gambar valid.');
      }
    };
    imgPreview.onerror = () => {
      imgPlaceholder.style.display = 'none';
      alert('Gagal memuat gambar.');
    };
  };
  reader.readAsDataURL(file);
}

fileInput.addEventListener('change', e => {
  if (e.target.files[0]) handleImageFile(e.target.files[0]);
});

dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) handleImageFile(file);
});

btnClearImg.addEventListener('click', () => {
  imgPreview.src = '';
  previewWrap.style.display = 'none';
  imgPalette.classList.add('hidden');
  imgExtractedColors = null;
  fileInput.value = '';
});

/* ================================================================
   SECTION 2 — TRI-COLOR HARMONY (5 warna, theme-aware)
================================================================ */

const btnHarmony     = document.getElementById('btnHarmony');
const harmonyPalette = document.getElementById('harmonyPalette');

/** Simpan 5 warna dasar harmony (tanpa tema) agar bisa di-re-theme */
let harmonyBaseColors = null;

/**
 * Menghasilkan palet harmonis (5 warna) dari 3 warna dasar.
 *
 * Strategi kalkulasi:
 *   Warna 1, 2, 3  → input user (3 warna)
 *   Warna 4: Tonal Bridge → rata hue (c1+c2), saturasi rendah, lightness tinggi
 *   Warna 5: Deep Accent  → komplementer rata ketiga hue, tone gelap
 *
 * Setelah 5 warna dasar terbentuk, terapkan tema untuk output akhir.
 *
 * @param {string} hex1, hex2, hex3 - Tiga warna dasar HEX
 * @returns {string[]} Array 5 kode HEX (sudah theme-adjusted)
 */
function generateHarmony(hex1, hex2, hex3) {
  const [h1, s1, l1] = rgbToHsl(...hexToRgb(hex1));
  const [h2, s2, l2] = rgbToHsl(...hexToRgb(hex2));
  const [h3, s3, l3] = rgbToHsl(...hexToRgb(hex3));

  // — Tonal Bridge: jembatan visual antara warna 1 dan 2 —
  const bridgeH = (h1 + h2) / 2;
  const bridgeS = clamp((s1 + s2) / 2 * 0.55, 0.08, 0.4);
  const bridgeL = clamp((l1 + l2) / 2 * 1.2, 0.72, 0.92);
  const bridge  = rgbToHex(...hslToRgb(bridgeH, bridgeS, bridgeL));

  // — Deep Accent: aksen gelap berbasis komplementer gabungan —
  const avgH  = (h1 + h2 + h3) / 3;
  const deepH = (avgH + 165) % 360;
  const deepS = clamp((s1 + s2 + s3) / 3 * 0.7, 0.15, 0.55);
  const deepL = clamp((l1 + l2 + l3) / 3 * 0.6, 0.18, 0.42);
  const deep  = rgbToHex(...hslToRgb(deepH, deepS, deepL));

  // Simpan 5 warna dasar (tanpa tema)
  harmonyBaseColors = [hex1, hex2, hex3, bridge, deep];

  // Terapkan tema aktif
  return applyThemeToArray(harmonyBaseColors, activeTheme);
}

btnHarmony.addEventListener('click', () => {
  const c1 = document.getElementById('c1').value;
  const c2 = document.getElementById('c2').value;
  const c3 = document.getElementById('c3').value;
  renderPalette(generateHarmony(c1, c2, c3), harmonyPalette);
});

/* ================================================================
   SECTION 3 — SURPRISE ME! (SEASON × THEME)
================================================================ */

const btnSurprise     = document.getElementById('btnSurprise');
const surprisePalette = document.getElementById('surprisePalette');
const seasonBadge     = document.getElementById('seasonBadge');
const surpriseDesc    = document.getElementById('surpriseDesc');

/** Simpan warna dasar surprise (tanpa tema) agar bisa di-re-theme */
let surpriseBaseColors = null;

/**
 * Data musim berbasis bulan (1–12).
 * Setiap palet berisi 5 warna [h, s%, l%].
 */
const SEASON_DATA = {
  winter_early: {
    name: 'Cool Winter', emoji: '❄️',
    desc: 'Nuansa biru dingin, abu slate, dan aksen putih bersih — minimalis dan fokus.',
    palettes: [
      [[210, 55, 88], [218, 40, 72], [220, 30, 52], [215, 20, 35], [200, 15, 22]],
      [[195, 60, 85], [205, 45, 68], [210, 35, 48], [220, 25, 30], [195, 10, 18]]
    ]
  },
  spring: {
    name: 'Fresh Spring', emoji: '🌸',
    desc: 'Hijau muda, merah muda lembut, dan kuning krem — segar dan penuh harapan.',
    palettes: [
      [[120, 42, 82], [350, 45, 80], [50, 60, 88], [140, 30, 65], [350, 20, 45]],
      [[100, 38, 78], [330, 40, 82], [55, 55, 84], [125, 25, 60], [340, 18, 48]]
    ]
  },
  summer_early: {
    name: 'Golden Summer', emoji: '☀️',
    desc: 'Oranye matang, kuning cerah, dan koral tropis — energi tinggi dan antusias.',
    palettes: [
      [[38, 88, 62], [22, 78, 58], [50, 90, 68], [15, 70, 52], [200, 45, 40]],
      [[42, 82, 65], [28, 75, 60], [55, 85, 70], [18, 65, 50], [210, 40, 38]]
    ]
  },
  summer_peak: {
    name: 'Peak Summer', emoji: '🏖️',
    desc: 'Biru lautan, putih pasir, merah terakota — vibrant dan kaya karakter.',
    palettes: [
      [[200, 65, 55], [45, 70, 75], [20, 60, 58], [180, 40, 62], [200, 20, 30]],
      [[195, 58, 52], [48, 65, 78], [25, 55, 55], [175, 35, 60], [205, 18, 28]]
    ]
  },
  autumn: {
    name: 'Rich Autumn', emoji: '🍂',
    desc: 'Coklat kayu, oranye tembaga, dan kuning tua — hangat, dalam, dan nyaman.',
    palettes: [
      [[30, 65, 45], [20, 70, 52], [40, 58, 60], [15, 50, 38], [35, 25, 25]],
      [[28, 60, 48], [18, 65, 50], [38, 55, 62], [12, 48, 35], [32, 22, 22]]
    ]
  },
  winter_late: {
    name: 'Dark Elegance', emoji: '🌙',
    desc: 'Navy malam, emas hangat, dan krim pucat — mewah, serius, dan tenang.',
    palettes: [
      [[220, 45, 28], [42, 65, 52], [50, 50, 82], [200, 30, 20], [40, 20, 70]],
      [[215, 40, 25], [45, 60, 50], [48, 48, 80], [205, 28, 18], [38, 18, 68]]
    ]
  }
};

/**
 * Menentukan musim berdasarkan bulan.
 */
function getSeason(month) {
  if (month <= 2)  return 'winter_early';
  if (month <= 4)  return 'spring';
  if (month <= 6)  return 'summer_early';
  if (month <= 8)  return 'summer_peak';
  if (month <= 10) return 'autumn';
  return 'winter_late';
}

/**
 * Menghasilkan palet musiman + theme-aware.
 *
 * Alur:
 *   1. Baca bulan → tentukan musim → pilih palet random
 *   2. Jitter kecil pada H/S/L agar unik per klik
 *   3. Konversi ke HEX dasar (tanpa tema)
 *   4. Terapkan tema aktif → output akhir
 *
 * @returns {string[]} Array 5 kode HEX
 */
function generateSeasonalPalette() {
  const now    = new Date();
  const month  = now.getMonth() + 1;
  const season = getSeason(month);
  const data   = SEASON_DATA[season];

  const base = data.palettes[Math.floor(Math.random() * data.palettes.length)];

  const jitter = (v, range) => clamp(v + (Math.random() * range * 2 - range), 0, 100);

  // Konversi ke HEX dasar (sebelum tema)
  surpriseBaseColors = base.map(([h, s, l]) => {
    const H = (h + (Math.random() * 14 - 7) + 360) % 360;
    const S = jitter(s, 6) / 100;
    const L = jitter(l, 5) / 100;
    return rgbToHex(...hslToRgb(H, S, L));
  });

  // Update badge dan deskripsi musim
  seasonBadge.textContent = `${data.emoji} ${data.name}`;
  surpriseDesc.textContent = data.desc;

  // Terapkan tema aktif
  return applyThemeToArray(surpriseBaseColors, activeTheme);
}

/** Inisialisasi badge musim */
function initSeasonBadge() {
  const month = new Date().getMonth() + 1;
  const data  = SEASON_DATA[getSeason(month)];
  seasonBadge.textContent  = `${data.emoji} ${data.name}`;
  surpriseDesc.textContent = data.desc;
}

btnSurprise.addEventListener('click', () => {
  renderPalette(generateSeasonalPalette(), surprisePalette);
});

/* ================================================================
   RE-GENERATE ALL PALETTES — saat tema berubah, render ulang
================================================================ */

/**
 * Ketika user mengganti tema, regenerate semua palet yang sudah pernah
 * dibuat (punya base colors tersimpan) dengan tema baru.
 */
function regenerateAllPalettes() {
  // Image palette
  if (imgExtractedColors && !imgPalette.classList.contains('hidden')) {
    renderPalette(applyThemeToArray(imgExtractedColors, activeTheme), imgPalette);
  }

  // Harmony palette
  if (harmonyBaseColors && !harmonyPalette.classList.contains('hidden')) {
    renderPalette(applyThemeToArray(harmonyBaseColors, activeTheme), harmonyPalette);
  }

  // Surprise palette — regenerate ulang (karena ada elemen random)
  if (!surprisePalette.classList.contains('hidden')) {
    renderPalette(generateSeasonalPalette(), surprisePalette);
  }
}

/* ================================================================
   INISIALIZASI — jalankan saat DOM siap
================================================================ */
window.addEventListener('DOMContentLoaded', () => {
  // Harmony: generate otomatis dengan nilai default
  renderPalette(generateHarmony('#E07B54', '#4A90D9', '#7BC67E'), harmonyPalette);

  // Surprise: set badge + generate palet pertama
  initSeasonBadge();
  renderPalette(generateSeasonalPalette(), surprisePalette);
});

/* ================================================================
   COPYRIGHT FOOTER — auto-update tahun
================================================================ */
const copyrightEl = document.getElementById('copyright-text');
if (copyrightEl) {
  copyrightEl.textContent = `© ${new Date().getFullYear()} KingSyah`;
}
