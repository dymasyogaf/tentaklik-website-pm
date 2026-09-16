import { useEffect, useState } from "react";
import { STATUSES, isUrl } from "../lib/tasks.js";

export default function TaskModal({ draft, halamanList, picList, onChange, onClose, onSave, onDelete }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = !draft.id;
  const canSave = draft.pekerjaan.trim().length > 0;
  const set = (key) => (e) => onChange({ ...draft, [key]: e.target.value });

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSave) onSave(draft);
        }}
      >
        <h2 id="task-title">{isNew ? "Tugas baru" : "Detail tugas"}</h2>
        <p className="hint">
          Satu tugas untuk satu pekerjaan atau revisi. Untuk revisi baru, awali judul dengan “Revisi 01 – …”.
          {!isNew && draft.updatedBy && <> Terakhir diubah oleh {draft.updatedBy}.</>}
        </p>

        <fieldset className="group">
          <legend>Tugas</legend>
          <div className="field">
            <span id="status-label">Status</span>
            <div className="stpick" role="radiogroup" aria-labelledby="status-label">
              {STATUSES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.status === s.id}
                  className={draft.status === s.id ? "on" : ""}
                  style={{ "--c": s.color, "--soft": s.soft, "--ink": s.ink }}
                  onClick={() => onChange({ ...draft, status: s.id })}
                >
                  <span className="dot" style={{ background: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Pekerjaan / revisi (wajib)</span>
            <input className="inp" value={draft.pekerjaan} onChange={set("pekerjaan")} autoFocus required placeholder="Contoh: Tulis ulang headline hero" />
          </label>
          <div className="grid2">
            <label className="field">
              <span>Halaman / bagian</span>
              <input className="inp" list="dl-halaman" value={draft.halaman} onChange={set("halaman")} placeholder="Contoh: Homepage – Hero" />
            </label>
            <label className="field">
              <span>PIC</span>
              <input className="inp" list="dl-pic" value={draft.pic} onChange={set("pic")} placeholder="Nama penanggung jawab" />
            </label>
            <label className="field">
              <span>Deadline</span>
              <input className="inp" type="date" value={draft.deadline} onChange={set("deadline")} />
            </label>
          </div>
          <datalist id="dl-halaman">{halamanList.map((h) => <option key={h} value={h} />)}</datalist>
          <datalist id="dl-pic">{picList.map((h) => <option key={h} value={h} />)}</datalist>
        </fieldset>

        <fieldset className="group">
          <legend>Arahan & copywriting</legend>
          <label className="field">
            <span>Arahan pengerjaan</span>
            <textarea className="inp" value={draft.arahan} onChange={set("arahan")} placeholder="Apa yang harus dikerjakan, batasan, dan hasil yang diharapkan" />
          </label>
          <label className="field">
            <span>Copywriting final</span>
            <textarea className="inp" value={draft.copywriting} onChange={set("copywriting")} placeholder="Teks final yang siap dipasang di website" />
          </label>
        </fieldset>

        <fieldset className="group">
          <legend>Aset & link</legend>
          {[
            ["screenshot", "Screenshot / link", "Tempel link screenshot (Google Drive, Lightshot, dsb.)"],
            ["referensi", "Link referensi", "Link website atau desain acuan"],
          ].map(([key, label, placeholder]) => (
            <div className="field" key={key}>
              <label htmlFor={`f-${key}`}>{label}</label>
              <div className="urlrow">
                <input id={`f-${key}`} className="inp" value={draft[key]} onChange={set(key)} placeholder={placeholder} />
                {isUrl(draft[key]) && (
                  <a className="btn" href={draft[key].trim()} target="_blank" rel="noreferrer">Buka link</a>
                )}
              </div>
            </div>
          ))}
        </fieldset>

        <fieldset className="group">
          <legend>Hasil</legend>
          <label className="field">
            <span>Catatan revisi / hasil</span>
            <textarea className="inp" value={draft.catatan} onChange={set("catatan")} placeholder="Apa yang sudah dikerjakan, kendala, atau link hasil" />
          </label>
        </fieldset>

        <div className="modal-foot">
          <div>
            {!isNew && (
              <button
                type="button"
                className={`btn btn-danger ${confirmDelete ? "armed" : ""}`}
                onClick={() => (confirmDelete ? onDelete(draft.id) : setConfirmDelete(true))}
              >
                {confirmDelete ? "Ya, hapus tugas ini" : "Hapus tugas"}
              </button>
            )}
          </div>
          <div className="row-gap">
            <button type="button" className="btn" onClick={onClose}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={!canSave}>
              {isNew ? "Tambah tugas" : "Simpan perubahan"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
