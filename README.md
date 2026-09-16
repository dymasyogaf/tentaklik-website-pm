# Tentaklik Website PM

Dashboard project management untuk memonitor pengerjaan website utama Tentaklik. Dibangun dengan **Astro + React island**, data disimpan di **Supabase** dan tersinkron realtime ke semua anggota tim.

Fitur: progress bar yang bisa diklik untuk filter status, progress per halaman, filter halaman/PIC/status, pencarian, tampilan Board (drag and drop) dan Tabel, detail tugas lengkap, impor dari file Excel Workspace lama, ekspor ke Excel, dan login email tanpa password khusus anggota tim.

## Struktur

```
src/
  pages/index.astro         Halaman utama (memuat dashboard sebagai React island)
  layouts/Layout.astro      HTML dasar, font, meta
  components/App.jsx        Cek konfigurasi, login magic link, cek anggota tim
  components/Board.jsx      Dashboard: ringkasan, filter, board, tabel, impor/ekspor
  components/TaskCard.jsx   Kartu tugas di board
  components/TaskModal.jsx  Form tambah/edit tugas
  lib/supabase.js           Koneksi Supabase
  lib/useTasks.js           Ambil data, realtime, tambah/ubah/hapus
  lib/tasks.js              Status, tanggal, mapping database, Excel
  styles/dashboard.css      Seluruh gaya (oranye #FF6B1A & putih)
supabase/schema.sql         Tabel, keamanan (RLS), realtime
```

## 1. Siapkan Supabase

1. Buat project baru di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel isi `supabase/schema.sql`, lalu **Run**.
3. Daftarkan email tim (masih di SQL Editor):
   ```sql
   insert into public.team_members (email) values
     ('ghani@tentaklik.com'),
     ('webdev@tentaklik.com');
   ```
   Hanya email di tabel ini yang bisa melihat dan mengubah tugas. Untuk mencabut akses, hapus barisnya.
4. Buka **Authentication > URL Configuration**:
   - **Site URL**: alamat dashboard setelah online, misalnya `https://pm.tentaklik.com`.
   - **Redirect URLs**: tambahkan alamat itu dan `http://localhost:4321` untuk uji coba lokal.
5. Buka **Project Settings > API**, salin **Project URL** dan **anon public key**.

Opsional tapi disarankan: di **Authentication > Sign In / Providers**, matikan pendaftaran user baru setelah semua anggota tim pernah login sekali, supaya orang luar tidak bisa membuat akun.

## 2. Jalankan di komputer

Butuh Node.js 18.20+ (disarankan 20 atau 22).

```bash
cp .env.example .env      # lalu isi PUBLIC_SUPABASE_URL dan PUBLIC_SUPABASE_ANON_KEY
npm install
npm run dev               # buka http://localhost:4321
```

Login dengan email yang sudah didaftarkan, klik link di email, dan board terbuka.

## 3. Pindahkan data dari artifact Claude

1. Di board artifact lama, klik **Ekspor Excel**.
2. Di dashboard baru, klik **Impor Excel**, pilih file tadi, lalu **Ganti semua isi board**.

File Workspace Excel asli (dengan checkbox "Selesai") juga bisa langsung diimpor.

## 4. Deploy ke Cloudflare

Proyek ini menghasilkan situs statis. `wrangler.jsonc` sudah menyiapkannya untuk **Cloudflare Workers static assets**.

Penting: `PUBLIC_SUPABASE_URL` dan `PUBLIC_SUPABASE_ANON_KEY` ditanam ke dalam bundle **saat build**, bukan dibaca saat situs dijalankan. Jadi keduanya harus tersedia di mesin/CI yang menjalankan `npm run build`. Jangan memakai `wrangler secret put` untuk ini — tidak akan terbaca.

### Cara A — dari komputer sendiri (paling cepat)

Pakai `.env` yang sudah terisi.

```bash
npx wrangler login        # sekali saja, membuka browser
npm run deploy            # astro build && wrangler deploy
```

Hasil: `https://tentaklik-website-pm.<subdomain>.workers.dev`.

Uji hasil build secara lokal sebelum deploy: `npm run cf:preview`.

### Cara B — Workers Builds (auto deploy tiap push)

1. Cloudflare Dashboard → **Workers & Pages** → **Create** → **Import a repository** → pilih repo ini.
2. Build command `npm run build`, deploy command `npx wrangler deploy`.
3. Di **Settings → Variables and Secrets**, tambahkan `PUBLIC_SUPABASE_URL` dan `PUBLIC_SUPABASE_ANON_KEY` dengan scope **Build**.

### Cara C — GitHub Actions

Workflow sudah ada di `.github/workflows/deploy.yml` (jalan tiap push ke `main`). Isi 4 secret di **GitHub → Settings → Secrets and variables → Actions**:

| Secret | Dari mana |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → template **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare → Workers & Pages, di sidebar kanan |
| `PUBLIC_SUPABASE_URL` | sama dengan isi `.env` |
| `PUBLIC_SUPABASE_ANON_KEY` | sama dengan isi `.env` |

### Setelah deploy (wajib)

Salin alamat final, lalu di Supabase → **Authentication → URL Configuration** masukkan ke **Site URL** dan **Redirect URLs**. Tanpa ini, link login akan mengarah ke alamat yang salah dan login gagal.

### Domain sendiri

Workers & Pages → Worker ini → **Settings → Domains & Routes → Add custom domain**, misalnya `pm.tentaklik.com` (domain harus sudah ada di akun Cloudflare). Jangan lupa tambahkan juga alamat ini ke Redirect URLs Supabase.

## Catatan keamanan

- `anon key` memang aman ditaruh di frontend. Yang menjaga data adalah Row Level Security di `schema.sql`: tanpa login dan tanpa terdaftar di `team_members`, database tidak mengembalikan data apa pun.
- Jangan pernah menaruh `service_role key` di file `.env` proyek ini.
- Halaman diberi `noindex` agar tidak muncul di Google.

## Mengubah warna

Semua warna ada di bagian atas `src/styles/dashboard.css` (`--orange`, `--orange-ink`, dan seterusnya). Warna status (To Do, In Progress, Selesai) ada di `STATUSES` pada `src/lib/tasks.js`.
