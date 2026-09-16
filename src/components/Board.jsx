import { useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";
import { useTasks } from "../lib/useTasks.js";
import { EMPTY_TASK, ST, STATUSES, dueInfo, exportExcel, isLate, isUrl, newId, norm, parseExcelFile } from "../lib/tasks.js";
import TaskCard from "./TaskCard.jsx";
import TaskModal from "./TaskModal.jsx";

const NO_FILTER = { q: "", halaman: "", pic: "", status: "" };
const ORDER = { todo: 0, progress: 1, done: 2 };

export default function Board({ session }) {
  const { tasks, sync, lastSync, create, update, remove, addMany, clearAll, replaceAll } = useTasks(session);

  const [view, setView] = useState("board");
  const [f, setF] = useState(NO_FILTER);
  const [sort, setSort] = useState({ key: "deadline", dir: 1 });
  const [editing, setEditing] = useState(null);
  const [importRows, setImportRows] = useState(null);
  const [toast, setToast] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef(null);
  const toastTimer = useRef(null);

  const say = (msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3500);
  };
  const report = (res, okMsg) => {
    if (res?.error) say("Perubahan gagal disimpan dan sudah dibatalkan. Periksa koneksi lalu ulangi.");
    else if (okMsg) say(okMsg);
  };

  // ---- data turunan ----
  const halamanList = useMemo(() => [...new Set(tasks.map((t) => t.halaman).filter(Boolean))].sort(), [tasks]);
  const picList = useMemo(() => [...new Set(tasks.map((t) => t.pic).filter(Boolean))].sort(), [tasks]);

  const scope = useMemo(() => {
    const q = norm(f.q);
    return tasks.filter(
      (t) =>
        (!f.halaman || t.halaman === f.halaman) &&
        (!f.pic || t.pic === f.pic) &&
        (!q || [t.halaman, t.pekerjaan, t.arahan, t.copywriting, t.catatan, t.pic].some((v) => norm(v).includes(q)))
    );
  }, [tasks, f.q, f.halaman, f.pic]);

  const visible = useMemo(() => {
    const list = f.status === "late" ? scope.filter(isLate) : f.status ? scope.filter((t) => t.status === f.status) : scope;
    const val = (t) =>
      sort.key === "deadline" ? t.deadline || "9999" : sort.key === "status" ? ORDER[t.status] : norm(t[sort.key]) || "\uffff";
    return [...list].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir);
  }, [scope, f.status, sort]);

  const stats = useMemo(() => {
    const s = { total: scope.length, todo: 0, progress: 0, done: 0, late: 0 };
    scope.forEach((t) => {
      s[t.status] += 1;
      if (isLate(t)) s.late += 1;
    });
    s.pct = s.total ? Math.round((s.done / s.total) * 100) : 0;
    return s;
  }, [scope]);

  const pageStats = useMemo(
    () =>
      halamanList.map((h) => {
        const list = tasks.filter((t) => t.halaman === h);
        return { h, total: list.length, done: list.filter((t) => t.status === "done").length };
      }),
    [tasks, halamanList]
  );

  const filtered = Boolean(f.q || f.halaman || f.pic || f.status);
  const scopeLabel = [f.halaman, f.pic, f.q && `“${f.q}”`].filter(Boolean).join(", ");

  // ---- aksi ----
  const toggleStatus = (id) => setF((p) => ({ ...p, status: p.status === id ? "" : id }));

  const openNew = () =>
    setEditing({ ...EMPTY_TASK, id: null, halaman: f.halaman, pic: f.pic, status: f.status && f.status !== "late" ? f.status : "todo" });

  const saveTask = async (draft) => {
    setEditing(null);
    if (!draft.id) report(await create({ ...draft, id: newId(), pekerjaan: draft.pekerjaan.trim() }), "Tugas ditambahkan.");
    else {
      const { id, createdAt, updatedAt, updatedBy, ...patch } = draft;
      report(await update(id, patch), "Perubahan disimpan.");
    }
  };

  const deleteTask = async (id) => {
    setEditing(null);
    report(await remove(id), "Tugas dihapus.");
  };

  const moveTask = async (id, status) => {
    const t = tasks.find((x) => x.id === id);
    if (!t || t.status === status) return;
    report(await update(id, { status }));
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const rows = await parseExcelFile(file);
      if (!rows) say("Kolom “Pekerjaan / revisi” tidak ditemukan. Pakai format file Workspace atau hasil ekspor board ini.");
      else if (!rows.length) say("File terbaca, tapi belum ada baris yang terisi di kolom Pekerjaan.");
      else setImportRows(rows);
    } catch {
      say("File tidak bisa dibaca. Pastikan formatnya .xlsx, .xls, atau .csv.");
    }
  };

  const onExport = async () => {
    try {
      await exportExcel(tasks);
      say("File Excel sedang diunduh.");
    } catch {
      say("File Excel gagal dibuat. Coba lagi.");
    }
  };

  const syncInfo = {
    loading: ["var(--muted)", "Memuat data…"],
    saving: ["var(--orange)", "Menyimpan…"],
    live: ["#16A34A", `Tersinkron dengan tim${lastSync ? `, ${lastSync.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}` : ""}`],
    error: ["var(--late)", "Perubahan terakhir gagal disimpan"],
    offline: ["var(--late)", "Koneksi realtime terputus, mencoba menyambung ulang"],
  }[sync];

  const SortTh = ({ k, children }) => (
    <th aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort((p) => ({ key: k, dir: p.key === k ? -p.dir : 1 }))}>
        {children}
        {sort.key === k ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
      </button>
    </th>
  );

  return (
    <div className="pm">
      <header className="band">
        <div className="band-row">
          <div>
            <h1 className="title">Projek Management Tentaklik</h1>
            <p className="sync">
              <span className="dot" style={{ background: syncInfo[0] }} />
              {syncInfo[1]}
            </p>
          </div>
          <div className="band-actions">
            <span className="who" title={session.user.email}>{session.user.email}</span>
            <button className="btn btn-ghost" onClick={() => supabase.auth.signOut()}>Keluar</button>
            <button className="btn btn-white" onClick={openNew}>Tambah tugas</button>
          </div>
        </div>
      </header>

      <section className="summary" aria-label="Progress pekerjaan">
        <div className="summary-head">
          <span className="pct">{stats.pct}%</span>
          <div>
            <p className="pct-sub">
              {stats.done} dari {stats.total} tugas selesai, {stats.total - stats.done} masih pending
            </p>
            {scopeLabel && <p className="pct-scope">Filter: {scopeLabel}</p>}
          </div>
        </div>

        <div className="bar" role="group" aria-label="Klik bagian bar untuk memfilter status">
          {["done", "progress", "todo"].map(
            (id) =>
              stats[id] > 0 && (
                <button
                  key={id}
                  className={`seg ${f.status && f.status !== id ? "dim" : ""}`}
                  style={{ flex: stats[id], background: id === "todo" ? "var(--track-todo)" : ST[id].color }}
                  title={`${ST[id].label}: ${stats[id]} tugas`}
                  aria-label={`Filter ${ST[id].label}, ${stats[id]} tugas`}
                  onClick={() => toggleStatus(id)}
                />
              )
          )}
        </div>

        <div className="legend">
          {["done", "progress", "todo"].map((id) => (
            <button key={id} className={`chip-btn ${f.status === id ? "on" : ""}`} onClick={() => toggleStatus(id)} aria-pressed={f.status === id}>
              <span className="dot" style={{ background: ST[id].color }} />
              {ST[id].label} <b>{stats[id]}</b>
            </button>
          ))}
          {stats.late > 0 && (
            <button className={`chip-btn late ${f.status === "late" ? "on" : ""}`} onClick={() => toggleStatus("late")} aria-pressed={f.status === "late"}>
              <span className="dot" style={{ background: "var(--late)" }} />
              Lewat deadline <b>{stats.late}</b>
            </button>
          )}
        </div>

        {pageStats.length > 0 && (
          <nav className="pages" aria-label="Progress per halaman">
            {pageStats.map((p) => (
              <button
                key={p.h}
                className={`page ${f.halaman === p.h ? "on" : ""}`}
                onClick={() => setF((x) => ({ ...x, halaman: x.halaman === p.h ? "" : p.h }))}
                aria-pressed={f.halaman === p.h}
              >
                <span className="page-name">{p.h}</span>
                <span className="page-meta">
                  <span className="mini">
                    <i style={{ width: `${(p.done / p.total) * 100}%` }} />
                  </span>
                  {p.done}/{p.total}
                </span>
              </button>
            ))}
          </nav>
        )}
      </section>

      <div className="toolbar">
        <input className="inp search" type="search" placeholder="Cari pekerjaan, arahan, catatan…" value={f.q} onChange={(e) => setF((p) => ({ ...p, q: e.target.value }))} aria-label="Cari tugas" />
        <select className="inp sel" value={f.halaman} onChange={(e) => setF((p) => ({ ...p, halaman: e.target.value }))} aria-label="Filter halaman">
          <option value="">Semua halaman</option>
          {halamanList.map((h) => <option key={h}>{h}</option>)}
        </select>
        <select className="inp sel" value={f.pic} onChange={(e) => setF((p) => ({ ...p, pic: e.target.value }))} aria-label="Filter PIC">
          <option value="">Semua PIC</option>
          {picList.map((h) => <option key={h}>{h}</option>)}
        </select>
        <select className="inp sel" value={f.status} onChange={(e) => setF((p) => ({ ...p, status: e.target.value }))} aria-label="Filter status">
          <option value="">Semua status</option>
          {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          <option value="late">Lewat deadline</option>
        </select>
        {filtered && <button className="link" onClick={() => setF(NO_FILTER)}>Hapus filter</button>}
        <div className="toolbar-end">
          <div className="toggle">
            <button className={view === "board" ? "on" : ""} onClick={() => setView("board")} aria-pressed={view === "board"}>Board</button>
            <button className={view === "table" ? "on" : ""} onClick={() => setView("table")} aria-pressed={view === "table"}>Tabel</button>
          </div>
          <button className="btn" onClick={() => fileRef.current?.click()}>Impor Excel</button>
          <button className="btn" onClick={onExport} disabled={!tasks.length}>Ekspor Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={onFile} />
        </div>
      </div>

      <main className="content">
        {view === "board" ? (
          <div className="board">
            {STATUSES.map((s) => {
              const list = visible.filter((t) => t.status === s.id);
              return (
                <section
                  key={s.id}
                  className={`col ${dragOver === s.id ? "over" : ""}`}
                  aria-label={s.label}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOver !== s.id) setDragOver(s.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(null);
                    const id = e.dataTransfer.getData("text/plain");
                    if (id) moveTask(id, s.id);
                  }}
                >
                  <div className="col-head">
                    <span className="dot dot-lg" style={{ background: s.color }} />
                    {s.label}
                    <span className="col-count">{list.length}</span>
                  </div>
                  {list.map((t) => (
                    <TaskCard key={t.id} task={t} onOpen={() => setEditing({ ...t })} onMove={moveTask} />
                  ))}
                  {list.length === 0 && (
                    <p className="empty">
                      {tasks.length === 0 && s.id === "todo" && sync !== "loading"
                        ? "Board masih kosong. Tambah tugas pertama atau impor file Excel."
                        : filtered
                        ? "Tidak ada tugas yang cocok dengan filter."
                        : "Seret kartu ke sini."}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        ) : (
          <div className="tablewrap">
            <table>
              <thead>
                <tr>
                  <SortTh k="status">Status</SortTh>
                  <SortTh k="halaman">Halaman / bagian</SortTh>
                  <th>Pekerjaan / revisi</th>
                  <SortTh k="pic">PIC</SortTh>
                  <SortTh k="deadline">Deadline</SortTh>
                  <th>Aset</th>
                  <th>Catatan revisi / hasil</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => {
                  const s = ST[t.status];
                  const due = dueInfo(t);
                  return (
                    <tr key={t.id} className="row" onClick={() => setEditing({ ...t })}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <select className="stsel" style={{ "--soft": s.soft, "--ink": s.ink }} value={t.status} onChange={(e) => moveTask(t.id, e.target.value)} aria-label="Ubah status">
                          {STATUSES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                        </select>
                      </td>
                      <td>{t.halaman || <span className="muted">–</span>}</td>
                      <td className="cell-title">{t.pekerjaan}</td>
                      <td className="nowrap">{t.pic || <span className="muted">–</span>}</td>
                      <td className="nowrap">{due ? <span className={`due ${due.tone}`}>{due.text}</span> : <span className="muted">–</span>}</td>
                      <td className="nowrap" onClick={(e) => e.stopPropagation()}>
                        {[["Screenshot", t.screenshot], ["Referensi", t.referensi]].map(([label, v]) =>
                          !v ? null : isUrl(v) ? (
                            <a key={label} href={v.trim()} target="_blank" rel="noreferrer" className="tag-mini">{label}</a>
                          ) : (
                            <span key={label} className="tag-mini" title={v}>{label}</span>
                          )
                        )}
                        {t.copywriting && <span className="tag-mini">Copy</span>}
                      </td>
                      <td><div className="clip">{t.catatan}</div></td>
                    </tr>
                  );
                })}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={7} className="empty">
                      {tasks.length === 0 ? "Belum ada tugas. Klik Tambah tugas atau impor file Excel." : "Tidak ada tugas yang cocok dengan filter."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <footer className="foot">
        <span>{tasks.length} tugas di board.</span>
        {tasks.length > 0 && (
          <button
            className={`btn btn-danger btn-sm ${confirmClear ? "armed" : ""}`}
            onClick={async () => {
              if (!confirmClear) {
                setConfirmClear(true);
                setTimeout(() => setConfirmClear(false), 4000);
                return;
              }
              setConfirmClear(false);
              report(await clearAll(), "Semua tugas dihapus dari board.");
            }}
          >
            {confirmClear ? "Klik lagi untuk menghapus semua tugas" : "Kosongkan board"}
          </button>
        )}
      </footer>

      {editing && (
        <TaskModal
          draft={editing}
          halamanList={halamanList}
          picList={picList}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={saveTask}
          onDelete={deleteTask}
        />
      )}

      {importRows && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && setImportRows(null)}>
          <div className="modal modal-sm" role="dialog" aria-modal="true" aria-labelledby="import-title">
            <h2 id="import-title">Impor {importRows.length} tugas</h2>
            <p className="hint">
              {importRows.filter((t) => t.status === "done").length} selesai, {importRows.filter((t) => t.status !== "done").length} belum. Board saat ini berisi {tasks.length} tugas.
            </p>
            <div className="modal-foot">
              <button className="btn" onClick={() => setImportRows(null)}>Batal</button>
              <div className="row-gap">
                <button
                  className="btn"
                  onClick={async () => {
                    const rows = importRows;
                    setImportRows(null);
                    report(await addMany(rows), `${rows.length} tugas ditambahkan ke board.`);
                  }}
                >
                  Tambahkan ke board
                </button>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    const rows = importRows;
                    setImportRows(null);
                    report(await replaceAll(rows), `Board diganti dengan ${rows.length} tugas dari file.`);
                  }}
                >
                  Ganti semua isi board
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
