"use client";

import { useEffect, useState } from "react";
import { apiJson } from "../api";

type Allocation = { allocationId: number; bookableId: number; startTime: string; endTime: string; resource?: { name: string } };
type Resource = { resourceId: number; name: string };
type Task = { taskId: number; name: string; bookableId: number };
type EventItem = { eventId: number; name: string; bookableId: number };

export default function AllocationsDemo() {
  const [items, setItems] = useState<Allocation[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [bookables, setBookables] = useState<Array<{ id: number; label: string }>>([]);
  const [resourceId, setResourceId] = useState("");
  const [bookableId, setBookableId] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [allocations, res, tasks, events] = await Promise.all([
      apiJson("/api/resource-allocations"),
      apiJson("/api/resources"),
      apiJson("/api/tasks"),
      apiJson("/api/events"),
    ]);
    setItems(allocations);
    setResources(res);
    const fromTasks = (tasks as Task[]).map((t) => ({ id: t.bookableId, label: `Task: ${t.name} (#${t.bookableId})` }));
    const fromEvents = (events as EventItem[]).map((e) => ({
      id: e.bookableId,
      label: `Event: ${e.name} (#${e.bookableId})`,
    }));
    setBookables([...fromTasks, ...fromEvents]);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Allocations</h1>
      <p className="text-xs text-gray-500">Needs a resource plus a task or event (for bookable id).</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form
        className="flex flex-col gap-2 max-w-md"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson("/api/resource-allocations", "POST", {
              resourceId: Number(resourceId),
              bookableId: Number(bookableId),
              startTime: new Date(startTime).toISOString(),
              endTime: new Date(endTime).toISOString(),
            });
            await refresh();
          } catch (err) {
            setError(String(err));
          }
        }}
      >
        <select className="border p-2 rounded text-sm" value={resourceId} onChange={(e) => setResourceId(e.target.value)} required>
          <option value="">Resource...</option>
          {resources.map((r) => (
            <option key={r.resourceId} value={r.resourceId}>{r.name}</option>
          ))}
        </select>
        <select className="border p-2 rounded text-sm" value={bookableId} onChange={(e) => setBookableId(e.target.value)} required>
          <option value="">Bookable (task/event)...</option>
          {bookables.map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </select>
        <input className="border p-2 rounded text-sm" type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        <input className="border p-2 rounded text-sm" type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        <button className="bg-blue-600 text-white py-2 rounded text-sm">Create</button>
      </form>

      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.allocationId} className="flex justify-between bg-gray-50 border p-2 rounded text-sm">
            <span>#{a.allocationId} {a.resource?.name} → bookable #{a.bookableId}</span>
            <button
              className="text-red-500 text-xs font-bold uppercase"
              onClick={async () => {
                setError("");
                try {
                  await apiJson(`/api/resource-allocations/${a.allocationId}`, "DELETE");
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
