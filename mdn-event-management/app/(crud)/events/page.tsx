"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-json";

type EventTask = { taskId: number; name: string; budget: string | null };
type EventItem = {
  eventId: number;
  name: string;
  date: string;
  location?: { name: string };
  totalBudget?: string;
  tasks?: EventTask[];
};
type Location = { locationId: number; name: string };

export default function EventsDemo() {
  const [items, setItems] = useState<EventItem[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [locationId, setLocationId] = useState("");
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const [allTasks, setAllTasks] = useState<{ taskId: number; name: string; eventId: number | null }[]>([]);
  const [assignSelections, setAssignSelections] = useState<Record<number, string>>({});

  async function refresh() {
    const [events, locs, tasks] = await Promise.all([
      apiJson("/api/events"),
      apiJson("/api/locations"),
      apiJson("/api/tasks"),
    ]);
    setItems(events);
    setLocations(locs);
    setAllTasks(tasks);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  async function assignTask(eventId: number) {
    const taskId = assignSelections[eventId];
    if (!taskId) return;
    setError("");
    try {
      await apiJson(`/api/tasks/${taskId}`, "PATCH", { eventId });
      setAssignSelections((prev) => ({ ...prev, [eventId]: "" }));
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Events</h1>
      <p className="text-xs text-gray-500">Create a location first if the dropdown is empty.</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form
        className="flex flex-col gap-2 max-w-md"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson("/api/events", "POST", {
              name,
              description,
              date: new Date(date).toISOString(),
              locationId: Number(locationId),
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
        <input className="border p-2 rounded text-sm" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
        <select className="border p-2 rounded text-sm" value={locationId} onChange={(e) => setLocationId(e.target.value)} required>
          <option value="">Location...</option>
          {locations.map((l) => (
            <option key={l.locationId} value={l.locationId}>{l.name}</option>
          ))}
        </select>
        <button className="bg-blue-600 text-white py-2 rounded text-sm">Create</button>
      </form>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson(`/api/events/${editId}`, "PATCH", { name });
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
        {items.map((ev) => (
          <li key={ev.eventId} className="flex flex-col gap-2 bg-gray-50 border border-gray-200 p-2 rounded text-sm text-gray-900">
            <div className="flex justify-between">
              <span>#{ev.eventId} {ev.name} ({ev.location?.name}) · budget ${ev.totalBudget ?? "0"}</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  className="text-red-500 text-xs font-bold uppercase"
                  onClick={async () => {
                    setError("");
                    try {
                      await apiJson(`/api/events/${ev.eventId}`, "DELETE");
                      await refresh();
                    } catch (err) {
                      setError(String(err));
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>

            {ev.tasks && ev.tasks.length > 0 && (
              <ul className="pl-4 text-xs text-gray-600 space-y-1">
                {ev.tasks.map((t) => (
                  <li key={t.taskId}>#{t.taskId} {t.name}{t.budget ? ` · $${t.budget}` : ""}</li>
                ))}
              </ul>
            )}

            <div className="flex gap-2 items-center pl-4">
              <select
                className="border p-1 rounded text-xs flex-grow"
                value={assignSelections[ev.eventId] ?? ""}
                onChange={(e) =>
                  setAssignSelections((prev) => ({ ...prev, [ev.eventId]: e.target.value }))
                }
              >
                <option value="">Assign existing task...</option>
                {allTasks
                  .filter((t) => t.eventId !== ev.eventId)
                  .map((t) => (
                    <option key={t.taskId} value={t.taskId}>
                      #{t.taskId} {t.name}{t.eventId ? ` (event #${t.eventId})` : " (unassigned)"}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="bg-purple-600 text-white px-2 py-1 rounded text-xs disabled:opacity-50"
                disabled={!assignSelections[ev.eventId]}
                onClick={() => assignTask(ev.eventId)}
              >
                Assign
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
