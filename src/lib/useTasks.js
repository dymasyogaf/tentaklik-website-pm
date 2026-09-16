import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase.js";
import { fromRow, toRow } from "./tasks.js";

const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

/**
 * Data tugas dari Supabase + realtime.
 * sync: "loading" | "live" | "saving" | "error" | "offline"
 */
export function useTasks(session) {
  const [tasks, setTasks] = useState([]);
  const [sync, setSync] = useState("loading");
  const [lastSync, setLastSync] = useState(null);
  const pending = useRef(0);
  const email = session?.user?.email || null;

  const fetchAll = useCallback(async () => {
    const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: true });
    if (error) {
      setSync("error");
      return false;
    }
    setTasks(data.map(fromRow));
    if (!pending.current) setSync("live");
    setLastSync(new Date());
    return true;
  }, []);

  useEffect(() => {
    if (!session) return undefined;
    fetchAll();

    const channel = supabase
      .channel("tasks-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, (payload) => {
        setTasks((prev) => {
          if (payload.eventType === "DELETE") return prev.filter((t) => t.id !== payload.old.id);
          const next = fromRow(payload.new);
          const i = prev.findIndex((t) => t.id === next.id);
          if (i < 0) return [...prev, next];
          const copy = [...prev];
          copy[i] = next;
          return copy;
        });
        setLastSync(new Date());
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") fetchAll(); // tutup celah data selama koneksi tersambung ulang
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setSync("offline");
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchAll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session, fetchAll]);

  /** Terapkan perubahan di layar dulu, lalu kirim ke database. Jika gagal, muat ulang data asli. */
  const run = useCallback(
    async (optimistic, request) => {
      if (optimistic) setTasks(optimistic);
      pending.current += 1;
      setSync("saving");
      let error = null;
      try {
        ({ error } = await request());
      } catch (e) {
        error = e;
      }
      pending.current -= 1;
      if (error) {
        await fetchAll();
        setSync("error");
        return { error };
      }
      if (!pending.current) {
        setSync("live");
        setLastSync(new Date());
      }
      return { error: null };
    },
    [fetchAll]
  );

  const create = (task) =>
    run(
      (prev) => [...prev, task],
      () => supabase.from("tasks").insert({ ...toRow(task), id: task.id, updated_by: email })
    );

  const update = (id, patch) =>
    run(
      (prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      () => supabase.from("tasks").update({ ...toRow(patch, { partial: true }), updated_by: email }).eq("id", id)
    );

  const remove = (id) =>
    run(
      (prev) => prev.filter((t) => t.id !== id),
      () => supabase.from("tasks").delete().eq("id", id)
    );

  const addMany = (list) =>
    run(
      (prev) => [...prev, ...list],
      async () => {
        for (const part of chunk(list.map((t) => ({ ...toRow(t), id: t.id, updated_by: email })), 500)) {
          const res = await supabase.from("tasks").insert(part);
          if (res.error) return res;
        }
        return { error: null };
      }
    );

  const clearAll = () =>
    run(
      () => [],
      () => supabase.from("tasks").delete().not("id", "is", null)
    );

  const replaceAll = async (list) => {
    const res = await clearAll();
    return res.error ? res : addMany(list);
  };

  return { tasks, sync, lastSync, refresh: fetchAll, create, update, remove, addMany, clearAll, replaceAll };
}
