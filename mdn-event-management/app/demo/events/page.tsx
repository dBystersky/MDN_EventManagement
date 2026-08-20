"use client";

import { useEffect, useState } from "react";
import { apiJson } from "../api";

type EventItem = { eventId: number; name: string; date: string; location?: { name: string } };
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

  async function refresh() {
    const [events, locs] = await Promise.all([
      apiJson("/api/events"),
      apiJson("/api/locations"),
    ]);
    setItems(events);
    setLocations(locs);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

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
          <li key={ev.eventId} className="flex justify-between bg-gray-50 border p-2 rounded text-sm">
            <span>#{ev.eventId} {ev.name} ({ev.location?.name})</span>
            <button
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
          </li>
        ))}
      </ul>
    </section>
  );
}
