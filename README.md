# Smart Color Palette Generator 🎨

Aplikasi web statis single-page untuk menghasilkan palet warna yang estetis, harmonis, dan siap pakai.

![Version](https://img.shields.io/badge/version-1.3.0-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Tech](https://img.shields.io/badge/tech-HTML%2FCSS%2FVanilla%20JS-orange)

---

## ✨ Fitur

### 🎭 Style / Theme Selector
Pilih gaya desain yang memengaruhi seluruh output palet:

| Tema | Karakter |
|------|----------|
| 🕊️ Dove / Soft Pastel | Warna lembut, muted, saturasi rendah |
| ⚡ Neon / Cyberpunk | Kontras tinggi, vibrant, bercahaya |
| 📷 Vintage / Retro | Earth tones hangat, desaturated, klasik |
| ◻️ Minimalist / Monochrome | Shade/tint bersih, fokus pada satu hue |

- **Undo ↩️** — history hingga 20 state, balik ke tema sebelumnya
- **Auto re-theme** — ganti tema langsung regenerate semua palet

### 🖼️ Image-to-Palette
- Drag & drop atau upload gambar (PNG, JPG, WEBP)
- Ekstrak 5 warna dominan via [Color Thief](https://github.com/lokesh/color-thief) (client-side)
- **Bridge ke Harmony** — satu klik untuk jadikan 3 warna teratas sebagai input Tri-Color Harmony

### 🔺 Tri-Color Harmony
- 3 color picker → generate palet 5 warna
- 5 mode harmoni: **Complementary**, **Analogous**, **Triadic**, **Split-Complementary**, **Tetradic**
- Warna tambahan disesuaikan secara matematis sesuai tema aktif

### ✨ Surprise Me!
- Baca waktu/bulan saat ini → tentukan musim (6 musim) sebagai konteks
- Setiap klik memilih 1 dari 6 strategi random secara acak:

| Strategi | Karakter |
|----------|----------|
| 🎲 Full Chaos | Hue 0–360° acak, saturation 55–95% |
| 💥 Split Complementary | Base hue + 4 warna berjauhan (150–270°) |
| 🌈 Neon Explosion | Saturation 80–100%, sangat vibrant |
| 🎨 Pastel Dream | Hue acak, low saturation, high lightness |
| 🌑 Dark Moody | Hue acak, lightness 10–40% |
| 🌈 Analogous Rainbow | 5 warna tersebar merata di 360° spectrum |

- **Benar-benar random** — tidak terikat palet pre-defined, theme tidak diterapkan

### 📋 Copy Format
Salin warna dalam format apa saja:

| Format | Contoh Output |
|--------|---------------|
| HEX | `#E07B54` |
| RGB | `rgb(224, 123, 84)` |
| HSL | `hsl(17, 69%, 60%)` |
| OKLCH | `oklch(0.617 0.130 17)` |

Klik chip warna → langsung copy sesuai format aktif.

### 📤 Export
Modal popup dengan 4 format ekspor:
- **CSS Variables** — `:root { --palette-1: #...; }`
- **Tailwind** — config snippet siap paste
- **JSON** — `{ "palette": [...] }`
- **PNG Download** — gambar 800×200px, auto text color

### 🚀 EVE Online Theme
Section khusus terpisah untuk membuat theme string EVE Online (4 warna). 3-step flow:

1. **Pilih Sumber Warna** — import dari palet lain atau generate random:
   - 🖼️ Dari Gambar (Image-to-Palette)
   - 🔺 Dari Harmony (Tri-Color)
   - ✨ Dari Surprise Me!
   - 🎲 Random (4 warna acak)
2. **Atur 4 Warna** — color picker untuk Primary, Secondary, Detail, Highlight
3. **Preview & Salin** — chip preview + string siap copy

> 💡 Paste string ke **EVE → Settings → General → Color Theme**

### 🔒 Palette Lock
Kunci warna tertentu (🔒) agar tidak berubah saat regenerate atau ganti tema.

### 🌙 Dark Mode
Toggle light/dark, state disimpan ke localStorage.

### ⚠️ Perceptual Color Distance
CIE76 ΔE calculation. Warning otomatis jika 2 warna terlalu mirip (ΔE < 10).

### 💫 Animasi
Transisi halus saat ganti tema — `420ms` smooth transition pada semua chip warna.

---

## 🚀 Quick Start

Tidak perlu build, tidak perlu npm. Buka langsung:

```bash
# Option 1: Buka file langsung
open index.html

# Option 2: Local server (recommended untuk Color Thief CORS)
python3 -m http.server 8080
# lalu buka http://localhost:8080
```

**Dependencies (CDN, auto-loaded):**
- [Color Thief 2.3.2](https://cdnjs.cloudflare.com/ajax/libs/color-thief/2.3.2/color-thief.umd.js) — ekstraksi warna
- [Google Fonts: Fraunces + DM Sans](https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600&family=DM+Sans:wght@300;400;500&display=swap) — tipografi

---

## 📁 Struktur Proyek

```
SmartColorPalette/
├── index.html      # Markup + struktur UI
├── style.css       # Styling + dark mode + responsive
├── app.js          # Seluruh logika aplikasi (800+ lines)
├── CHANGELOG.md    # Riwayat versi
└── README.md       # Dokumentasi ini
```

---

## 🧠 Algoritma Warna

### Theme Modifier
Setiap tema menerapkan transformasi HSL pada warna dasar:

```
H_new = (H + hShift + 360) % 360
S_new = clamp(S * sMod, sFloor, sCap)
L_new = clamp(L * lMod, lFloor, lCap)
```

| Tema | sMod | lMod | hShift | sCap |
|------|------|------|--------|------|
| Dove | 0.45 | 1.15 | 0° | 0.38 |
| Neon | 1.50 | 0.95 | 0° | 1.00 |
| Vintage | 0.55 | 0.92 | -8° | 0.50 |
| Minimalist | 0.15 | 1.00 | 0° | 0.18 |

### Harmony Modes
Dari rata-rata hue 3 input, hitung 2 hue tambahan:

| Mode | Hue 4 | Hue 5 |
|------|-------|-------|
| Complementary | avgH + 180° | avgH + 160° |
| Analogous | avgH + 30° | avgH - 30° |
| Triadic | avgH + 120° | avgH + 240° |
| Split-Comp | avgH + 150° | avgH + 210° |
| Tetradic | avgH + 90° | avgH + 270° |

### Perceptual Distance (CIE76 ΔE)
```
sRGB → linearize → XYZ (D65) → CIE-Lab → Euclidean distance
```

### Surprise Me! Strategies
6 strategi yang dipilih acak:

```
1. Full Chaos:        H = rand(0,360), S = rand(55,95%), L = rand(25,75%)
2. Split Complement:  base H + [0°, ~165°, ~225°, ~110°, ~290°] ± jitter
3. Neon Explosion:    H = rand(0,360), S = rand(80,100%), L = rand(45,70%)
4. Pastel Dream:      H = rand(0,360), S = rand(25,60%), L = rand(70,92%)
5. Dark Moody:        H = rand(0,360), S = rand(30,85%), L = rand(10,40%)
6. Analogous Rainbow: H = start + [0°, 72°, 144°, 216°, 288°] ± 10°
```

### EVE Online 4-Color Selection
Dari 5 warna, buang 1 yang paling mirip tetangganya:
```
drop = min( (ΔE(i, i-1) + ΔE(i, i+1)) / 2 )  untuk i ∈ [1,2,3]
```

---

## 🎯 Browser Support

| Browser | Status |
|---------|--------|
| Chrome 90+ | ✅ Full |
| Firefox 88+ | ✅ Full |
| Safari 14+ | ✅ Full |
| Edge 90+ | ✅ Full |
| Mobile Chrome/Safari | ✅ Responsive |

> ⚠️ `navigator.clipboard` membutuhkan HTTPS atau localhost.

---

## 📄 License

MIT License — bebas digunakan, dimodifikasi, dan didistribusikan.

---

<div align="center">

**Made with ❤️** • © 2026 KingSyah 👑

</div>
