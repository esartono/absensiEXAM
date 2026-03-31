# E-Berita Acara PSAJ

Aplikasi absensi dan berita acara ujian berbasis React + Vite.

## Fitur Utama

- Form berita acara ujian (tanggal, hari, ruang, mapel, pengawas, waktu, tempat, catatan)
- Daftar siswa otomatis berdasarkan ruang
- Status kehadiran per siswa: Hadir, Sakit, Izin, Alpa
- Rekap kehadiran otomatis
- Upload foto ruang
- Paraf pengawas via canvas (touch/mouse)
- Validasi form sebelum simpan
- Integrasi ke Google Apps Script via `VITE_SCRIPT_URL`

## Menjalankan Aplikasi

1. Install dependencies:

	```bash
	npm install
	```

2. Jalankan mode development:

	```bash
	npm run dev
	```

3. Build production:

	```bash
	npm run build
	```

## Konfigurasi Google Apps Script

Secara default aplikasi berjalan di mode simulasi (data disimpan sementara ke localStorage browser).

Jika ingin kirim ke Apps Script:

1. Buat file `.env` di root project.
2. Isi variabel berikut:

	```bash
	VITE_SCRIPT_URL=https://script.google.com/macros/s/XXXXXXXXXXXX/exec
	```

3. Restart dev server.

## Struktur Singkat

- `src/App.jsx`: komponen utama aplikasi
- `src/index.css`: style global + Tailwind directives
- `tailwind.config.js`: konfigurasi scan class Tailwind
