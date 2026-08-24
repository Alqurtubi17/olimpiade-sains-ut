# Final Olimpiade Sains — Aplikasi Operator & Live Sync Pertandingan

Aplikasi web modern & presisi untuk mengelola pertandingan olimpiade sains dengan fitur utama:
- **Dukungan Jumlah Tim Dinamis (2 s/d 8 Tim)** dengan warna tema & identitas unik.
- **Live Sync Real-Time Multi-Perangkat (Tanpa Database)** via WebSocket Pub/Sub.
- **Pilihan Tema Dark Mode & Light Mode** untuk kenyamanan layar proyektor / panggung.
- Timer 45 detik, Soal Wajib (+100), Soal Rebutan (+150 / -50), bel rebutan presisi milidetik.
- Audit log skor lengkap, mode Layar Besar / Projector View, dan export rekap Excel (.xlsx).

---

## 1. Fitur Utama

### 📡 A. Live Sync Real-Time (Tanpa Database)
- Setiap pertandingan menghasilkan **Kode Ruangan Unik** (contoh: `OS-8A2F`).
- Cukup bagikan link (`https://domain.com/?room=OS-8A2F`) ke laptop proyektor, juri, atau penonton.
- Update skor, timer, dan status pertandingan ter-sync secara **instant (<50 ms)** ke semua perangkat yang terhubung.
- Data tetap memiliki backup otomatis di `localStorage` lokal agar aman walaupun koneksi terputus.

### 👥 B. Multi-Tim Fleksibel (2 s/d 8 Tim)
- Tentukan jumlah tim saat Setup Pertandingan (2, 3, 4, 5, 6, 7, atau 8 tim).
- Beri nama tim, instansi/sekolah, dan pilih warna identitas (Biru, Merah, Hijau, Kuning, Ungu, Pink, Cyan, Nila).
- Tampilan Dashboard dan Layar Proyektor beradaptasi dalam grid responsif yang rapi.

### ☀️🌙 C. Theme Switcher (Dark & Light Mode)
- Klik tombol **Sun / Moon** di header atas untuk berganti tema tampilan.
- **Dark Mode:** Latar Slate-950 modern dengan efek glowing glassmorphic.
- **Light Mode:** Latar Slate-50 bersih dengan kontras tinggi untuk ruangan terang.

---

## 2. Menjalankan di Komputer Lokal

Membutuhkan [Node.js](https://nodejs.org) versi 18 ke atas.

```bash
# 1. Masuk ke folder project
cd final-olimpiade-sains-2026

# 2. Install dependency
npm install

# 3. Jalankan mode development
npm run dev
```

Buka alamat yang muncul di terminal (biasanya `http://localhost:5173`).

---

## 3. Build & Deploy ke Vercel

```bash
# Build untuk produksi
npm run build

# Deploy via Vercel CLI (opsional)
npx vercel --prod
```

---

## 4. Struktur Project

```
final-olimpiade-sains-2026/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── vercel.json
└── src/
    ├── main.jsx              # Entry point aplikasi
    ├── App.jsx                # Komponen utama (Multi-Tim, Setup, Dashboard, Projector, Recap)
    ├── index.css               # Styling Tailwind, CSS Variables Dark/Light, Fonts
    └── lib/
        ├── sync-engine.js     # Engine Live Sync WebSocket MQTT tanpa database
        └── storage-shim.js     # Storage shim & trigger broadcast
```
