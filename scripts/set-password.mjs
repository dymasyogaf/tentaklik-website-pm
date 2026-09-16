// Buat atau atur ulang akun tim lewat Admin API Supabase.
//
//   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/set-password.mjs email@domain.com password
//
// Service role key mem-bypass semua Row Level Security. Ambil dari
// Supabase > Project Settings > API > service_role, berikan lewat variabel
// shell seperti di atas, dan jangan pernah menyimpannya di .env atau di repo.
//
// Script ini idempoten: akun yang sudah ada diperbarui passwordnya,
// yang belum ada dibuat. Email langsung dikonfirmasi supaya bisa dipakai
// tanpa menunggu email masuk. Emailnya juga didaftarkan ke team_members.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error("Pakai: node scripts/set-password.mjs <email> <password>");
  process.exit(1);
}

// URL project diambil dari .env; hanya service key yang lewat variabel shell.
const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split("\n")
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const at = line.indexOf("=");
      return [line.slice(0, at).trim(), line.slice(at + 1).trim()];
    }),
);

const url = env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error("PUBLIC_SUPABASE_URL tidak ditemukan di .env");
  process.exit(1);
}
if (!serviceKey) {
  console.error("SUPABASE_SERVICE_ROLE_KEY belum diisi. Lihat komentar di atas file ini.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

// listUsers dipaginasi; telusuri sampai ketemu agar tetap benar saat tim membesar.
async function findUser(mail) {
  const target = mail.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 1000) return null;
  }
}

const existing = await findUser(email);

if (existing) {
  const { error } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Password diperbarui: ${email}`);
} else {
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  console.log(`Akun dibuat: ${email}`);
}

const { error: memberError } = await admin
  .from("team_members")
  .upsert({ email }, { onConflict: "email" });
if (memberError) throw memberError;
console.log(`Terdaftar di team_members: ${email}`);
