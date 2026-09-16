// Status, helper tanggal, mapping database, dan impor/ekspor Excel.

export const STATUSES = [
  { id: "todo", label: "To Do", color: "#A3A9B3", soft: "#F3F4F6", ink: "#4B5563" },
  { id: "progress", label: "In Progress", color: "#FFA766", soft: "#FFF1E6", ink: "#C2410C" },
  { id: "done", label: "Selesai", color: "#FF6B1A", soft: "#FFE4D2", ink: "#9A3412" },
];
export const ST = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

export const EMPTY_TASK = {
  status: "todo", halaman: "", pekerjaan: "", arahan: "", screenshot: "",
  copywriting: "", referensi: "", pic: "", deadline: "", catatan: "",
};

const FIELDS = ["status", "halaman", "pekerjaan", "arahan", "screenshot", "copywriting", "referensi", "pic", "deadline", "catatan"];

export const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

const pad = (n) => String(n).padStart(2, "0");
export const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const norm = (v) => String(v ?? "").trim().toLowerCase();
export const isUrl = (s) => /^https?:\/\//i.test((s || "").trim());
export const initials = (s) => (s || "?").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function dayDiff(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((new Date(y, m - 1, d) - today) / 86400000);
}

export function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export function dueInfo(t) {
  if (!t.deadline) return null;
  const n = dayDiff(t.deadline);
  if (t.status === "done") return { text: fmtDate(t.deadline), tone: "muted" };
  if (n < 0) return { text: `Lewat ${-n} hari`, tone: "late" };
  if (n === 0) return { text: "Hari ini", tone: "soon" };
  if (n === 1) return { text: "Besok", tone: "soon" };
  return { text: fmtDate(t.deadline), tone: "normal" };
}

export const isLate = (t) => Boolean(t.deadline) && t.status !== "done" && dayDiff(t.deadline) < 0;

// ---- mapping database <-> aplikasi ----
export function fromRow(row) {
  return {
    ...EMPTY_TASK,
    ...Object.fromEntries(FIELDS.map((f) => [f, row[f] ?? ""])),
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by || "",
  };
}

/** Hanya kolom yang dikenal database; `partial` = untuk update sebagian. */
export function toRow(task, { partial = false } = {}) {
  const row = {};
  for (const f of FIELDS) {
    if (partial && !(f in task)) continue;
    let v = task[f] ?? "";
    if (f === "deadline") v = v || null;
    else if (typeof v === "string") v = f === "pekerjaan" ? v.trim() : v;
    row[f] = v;
  }
  return row;
}

// ---- Excel ----
function toISODeadline(XLSX, v) {
  if (v === "" || v == null) return "";
  if (typeof v === "number") {
    const p = XLSX.SSF.parse_date_code(v);
    return p ? `${p.y}-${pad(p.m)}-${pad(p.d)}` : "";
  }
  if (v instanceof Date) return isoOf(v);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  return "";
}

/**
 * Membaca file Workspace asli (kolom checkbox "Selesai") maupun file hasil
 * ekspor aplikasi ini (ada kolom "Status"). Mengembalikan null jika header
 * tabel tidak ditemukan.
 */
export async function parseExcelFile(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
    const hi = rows.findIndex(
      (r) => r.some((c) => norm(c).startsWith("pekerjaan")) && r.some((c) => norm(c).startsWith("halaman") || norm(c).startsWith("pic"))
    );
    if (hi < 0) continue;
    const head = rows[hi].map(norm);
    const col = (k) =>
      head.findIndex((h) => (k === "pic" ? h.startsWith("pic") : k === "selesai" ? h === "selesai" : h.includes(k)));
    const C = Object.fromEntries(
      ["status", "selesai", "halaman", "pekerjaan", "arahan", "screenshot", "copywriting", "referensi", "pic", "deadline", "catatan"].map((k) => [k, col(k)])
    );
    const get = (r, k) => (C[k] >= 0 ? r[C[k]] : "");
    const text = (r, k) => String(get(r, k) ?? "").trim();

    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const pekerjaan = text(r, "pekerjaan");
      if (!pekerjaan) continue;
      const sv = norm(get(r, "status"));
      const match = STATUSES.find(
        (s) => sv && (norm(s.label) === sv || s.id === sv || (s.id === "progress" && sv.includes("progress")))
      );
      let status = match ? match.id : "todo";
      if (!match) {
        const done = get(r, "selesai");
        if (done === true || ["true", "ya", "x", "✓", "1", "selesai"].includes(norm(done))) status = "done";
      }
      out.push({
        ...EMPTY_TASK,
        id: newId(),
        status,
        pekerjaan,
        halaman: text(r, "halaman"),
        arahan: text(r, "arahan"),
        screenshot: text(r, "screenshot"),
        copywriting: text(r, "copywriting"),
        referensi: text(r, "referensi"),
        pic: text(r, "pic"),
        deadline: toISODeadline(XLSX, get(r, "deadline")),
        catatan: text(r, "catatan"),
      });
    }
    return out;
  }
  return null;
}

export async function exportExcel(tasks) {
  const XLSX = await import("xlsx");
  const header = [
    "Status", "Selesai", "Halaman / bagian", "Pekerjaan / revisi", "Arahan pengerjaan", "Screenshot / link",
    "Copywriting final", "Link referensi", "PIC", "Deadline", "Catatan revisi / hasil",
  ];
  const aoa = [
    header,
    ...tasks.map((t) => [
      ST[t.status]?.label || "To Do", t.status === "done", t.halaman, t.pekerjaan, t.arahan, t.screenshot,
      t.copywriting, t.referensi, t.pic, t.deadline, t.catatan,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [14, 10, 26, 32, 36, 28, 38, 26, 14, 13, 34].map((wch) => ({ wch }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Workspace");
  XLSX.writeFile(wb, `Tentaklik_Website_PM_${isoOf(new Date())}.xlsx`);
}
