"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/api-json";

type ResourceType = { typeId: number; name: string };

export default function ResourceTypesDemo() {
  const [items, setItems] = useState<ResourceType[]>([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    setItems(await apiJson("/api/resource-types"));
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Resource types</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson("/api/resource-types", "POST", { name });
            setName("");
            await refresh();
          } catch (err) {
            setError(String(err));
          }
        }}
      >
        <input className="border p-2 rounded text-sm flex-grow" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Create</button>
      </form>

      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson(`/api/resource-types/${editId}`, "PATCH", { name });
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
          <li key={t.typeId} className="flex justify-between bg-gray-50 border border-gray-200 p-2 rounded text-sm text-gray-900">
            <span>#{t.typeId} {t.name}</span>
            <button
              className="text-red-500 text-xs font-bold uppercase"
              onClick={async () => {
                setError("");
                try {
                  await apiJson(`/api/resource-types/${t.typeId}`, "DELETE");
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
