"use client";

import { useEffect, useState } from "react";
import { apiJson } from "../api";

type Task = { taskId: number; name: string; deadline: string; bookableId: number };

export default function TasksDemo() {
  const [items, setItems] = useState<Task[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setItems(await apiJson("/api/tasks"));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Tasks</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form
        className="flex flex-col gap-2 max-w-md"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson("/api/tasks", "POST", {
              name,
              description,
              deadline: new Date(deadline).toISOString(),
            });
            setName("");
            setDescription("");
            await refresh();
          } catch (err) {
            setError(String(err));
          }
        }}
      >
        <input className="border p-2 rounded text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="border p-2 rounded text-sm" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
        <input className="border p-2 rounded text-sm" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        <button className="bg-blue-600 text-white py-2 rounded text-sm">Create</button>
      </form>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson(`/api/tasks/${editId}`, "PATCH", { name });
            await refresh();
          } catch (err) {
            setError(String(err));
          }
        }}
      >
        <input className="border p-2 rounded text-sm w-24" placeholder="id" value={editId} onChange={(e) => setEditId(e.target.value)} required />
        <input className="border p-2 rounded text-sm flex-grow" placeholder="New name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="bg-green-600 text-white px-4 py-2 rounded text-sm">Update</button>
      </form>

      <ul className="space-y-2">
        {items.map((t) => (
          <li key={t.taskId} className="flex justify-between bg-gray-50 border p-2 rounded text-sm">
            <span>#{t.taskId} {t.name} · bookable #{t.bookableId}</span>
            <button
              className="text-red-500 text-xs font-bold uppercase"
              onClick={async () => {
                setError("");
                try {
                  await apiJson(`/api/tasks/${t.taskId}`, "DELETE");
                  await refresh();
                } catch (err) {
                  setError(String(err));
                }
              }}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
