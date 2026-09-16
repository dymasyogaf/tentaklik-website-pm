import { ST, dueInfo, initials, isLate } from "../lib/tasks.js";

const NEXT = { todo: ["progress", "Mulai kerjakan"], progress: ["done", "Tandai selesai"], done: null };

export default function TaskCard({ task: t, onOpen, onMove }) {
  const s = ST[t.status];
  const due = dueInfo(t);
  const next = NEXT[t.status];

  return (
    <article
      className={`card ${isLate(t) ? "card-late" : ""} ${t.status === "done" ? "card-done" : ""}`}
      style={{ "--c": s.color }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${t.pekerjaan}, ${s.label}`}
    >
      {t.halaman && <span className="tag">{t.halaman}</span>}
      <h3 className="card-title">{t.pekerjaan}</h3>
      <div className="card-foot">
        {t.pic && (
          <>
            <span className="avatar" aria-hidden="true">{initials(t.pic)}</span>
            <span>{t.pic}</span>
          </>
        )}
        {due && <span className={`due ${due.tone}`}>{due.text}</span>}
        <span className="card-flags">
          {t.copywriting && <span className="tag-mini" title="Ada copywriting final">Copy</span>}
          {(t.screenshot || t.referensi) && <span className="tag-mini" title="Ada screenshot atau referensi">Link</span>}
          {t.catatan && <span className="tag-mini" title="Ada catatan revisi">Catatan</span>}
        </span>
      </div>
      {next && (
        <button
          className="quick"
          style={{ "--c": ST[next[0]].color, "--ink": ST[next[0]].ink }}
          onClick={(e) => {
            e.stopPropagation();
            onMove(t.id, next[0]);
          }}
        >
          {next[1]}
        </button>
      )}
    </article>
  );
}
