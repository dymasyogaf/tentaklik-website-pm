import { useEffect, useState } from "react";
import { isConfigured, supabase } from "../lib/supabase.js";
import Board from "./Board.jsx";

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = belum dicek
  const [member, setMember] = useState(undefined);

  useEffect(() => {
    if (!isConfigured) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
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

function Login() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [message, setMessage] = useState("");

  const send = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      setState("error");
      setMessage(error.message);
    } else {
      setState("sent");
    }
  };

  return (
    <Shell>
      <h1 className="auth-title">Rombak Total Website Utama</h1>
      {state === "sent" ? (
        <p className="auth-text">
          Link masuk sudah dikirim ke <strong>{email}</strong>. Buka email tersebut dan klik link-nya dari perangkat ini.
        </p>
      ) : (
        <form onSubmit={send}>
          <p className="auth-text">Masukkan email tim Anda. Kami kirim link masuk, tanpa password.</p>
          <label className="field">
            <span>Email</span>
            <input className="inp" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@tentaklik.com" />
          </label>
          {state === "error" && <p className="auth-error">Link gagal dikirim: {message}</p>}
          <button className="btn btn-primary btn-block" type="submit" disabled={state === "sending"}>
            {state === "sending" ? "Mengirim link…" : "Kirim link masuk"}
          </button>
        </form>
      )}
    </Shell>
  );
}
