import { useEffect, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase.js";
import Board from "./Board.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = belum dicek
  const [member, setMember] = useState(undefined);
  const [recovering, setRecovering] = useState(false); // datang dari link reset password

  useEffect(() => {
    if (!isConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setMember(undefined);
      return;
    }
    supabase
      .from("team_members")
      .select("email")
      .limit(1)
      .then(({ data, error }) => setMember(!error && data.length > 0));
  }, [session]);

  if (!isConfigured) {
    return (
      <Shell>
        <h1 className="auth-title">Supabase belum tersambung</h1>
        <p className="auth-text">
          Buat file <code>.env</code> dari <code>.env.example</code>, isi <code>PUBLIC_SUPABASE_URL</code> dan{" "}
          <code>PUBLIC_SUPABASE_ANON_KEY</code>, lalu jalankan ulang <code>npm run dev</code>. Langkah lengkapnya ada di README.
        </p>
      </Shell>
    );
  }

  if (session === undefined || (session && member === undefined)) {
    return (
      <Shell>
        <p className="auth-text">Memuat…</p>
      </Shell>
    );
  }

  if (!session) return <Login />;

  if (recovering) return <SetNewPassword onDone={() => setRecovering(false)} />;

  if (!member) {
    return (
      <Shell>
        <h1 className="auth-title">Email belum terdaftar di tim</h1>
        <p className="auth-text">
          Anda masuk sebagai <strong>{session.user.email}</strong>, tapi email ini belum ada di daftar anggota tim. Minta admin
          menambahkannya ke tabel <code>team_members</code> di Supabase, lalu muat ulang halaman.
        </p>
        <button className="btn" onClick={() => supabase.auth.signOut()}>Keluar dan pakai email lain</button>
      </Shell>
    );
  }

  return <Board session={session} />;
}

function Shell({ children }) {
  return (
    <div className="auth">
      <div className="auth-band" />
      <div className="auth-card">
        <p className="auth-brand">Tentaklik</p>
        {children}
      </div>
    </div>
  );
}

// Layar setelah user mengklik link reset password dari email.
function SetNewPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setError(translate(error.message));
    else onDone();
  };

  return (
    <Shell>
      <h1 className="auth-title">Buat password baru</h1>
      <form onSubmit={save}>
        <p className="auth-text">Masukkan password baru untuk akun Anda.</p>
        <label className="field">
          <span>Password baru</span>
          <input
            className="inp"
            type="password"
            required
            minLength={6}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimal 6 karakter"
          />
        </label>
        {error && <p className="auth-error">{error}</p>}
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan password"}
        </button>
      </form>
    </Shell>
  );
}

// Pesan error Supabase berbahasa Inggris; terjemahkan yang paling sering muncul.
const ERRORS = {
  "Invalid login credentials": "Email atau password salah.",
  "Email not confirmed": "Email belum dikonfirmasi. Buka link konfirmasi yang kami kirim ke inbox Anda.",
  "User already registered": "Email ini sudah terdaftar. Silakan masuk.",
  "Password should be at least 6 characters": "Password minimal 6 karakter.",
};
const translate = (msg) => ERRORS[msg] || msg;

const MODES = {
  login: { title: "Masuk", submit: "Masuk", busy: "Memeriksa…" },
  register: { title: "Buat akun", submit: "Daftar", busy: "Mendaftarkan…" },
  forgot: { title: "Lupa password", submit: "Kirim link reset", busy: "Mengirim…" },
};

function Login() {
  const [mode, setMode] = useState("login"); // login | register | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(""); // pesan sukses yang butuh aksi user

  const go = (next) => {
    setMode(next);
    setError("");
    setNotice("");
    setPassword("");
  };

  const submit = async (e) => {
    e.preventDefault();
    const mail = email.trim();
    if (!mail) return;
    setBusy(true);
    setError("");

    const redirect = window.location.origin + window.location.pathname;

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(mail, { redirectTo: redirect });
      setBusy(false);
      if (error) setError(translate(error.message));
      else setNotice(`Link untuk mengatur ulang password sudah dikirim ke ${mail}.`);
      return;
    }

    if (mode === "register") {
      const { data, error } = await supabase.auth.signUp({
        email: mail,
        password,
        options: { emailRedirectTo: redirect },
      });
      setBusy(false);
      if (error) {
        setError(translate(error.message));
      } else if (!data.session) {
        // Supabase mewajibkan konfirmasi email sebelum akun aktif.
        setNotice(`Akun dibuat. Buka email di ${mail} dan klik link konfirmasi, lalu masuk.`);
      }
      // Kalau data.session ada, onAuthStateChange di atas langsung memindahkan layar.
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
    setBusy(false);
    if (error) setError(translate(error.message));
  };

  const copy = MODES[mode];

  return (
    <Shell>
      <h1 className="auth-title">{copy.title}</h1>

      {notice ? (
        <>
          <p className="auth-text">{notice}</p>
          <button className="btn btn-block" onClick={() => go("login")}>Kembali ke halaman masuk</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="auth-text">
            {mode === "login" && "Masuk dengan email dan password akun tim Anda."}
            {mode === "register" && "Daftarkan email tim Anda. Akses board diberikan admin setelah akun dibuat."}
            {mode === "forgot" && "Masukkan email akun Anda. Kami kirim link untuk membuat password baru."}
          </p>

          <label className="field">
            <span>Email</span>
            <input
              className="inp"
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@tentaklik.com"
            />
          </label>

          {mode !== "forgot" && (
            <label className="field">
              <span>Password</span>
              <input
                className="inp"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "register" ? "Minimal 6 karakter" : "••••••••"}
              />
            </label>
          )}

          {mode === "login" && (
            <button type="button" className="auth-link auth-link-right" onClick={() => go("forgot")}>
              Lupa password?
            </button>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
            {busy ? copy.busy : copy.submit}
          </button>

          <p className="auth-switch">
            {mode === "login" ? (
              <>Belum punya akun? <button type="button" className="auth-link" onClick={() => go("register")}>Daftar</button></>
            ) : (
              <>Sudah punya akun? <button type="button" className="auth-link" onClick={() => go("login")}>Masuk</button></>
            )}
          </p>
        </form>
      )}
    </Shell>
  );
}
