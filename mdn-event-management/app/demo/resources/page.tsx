"use client";

import { useEffect, useState } from "react";
import { apiJson } from "../api";

type Resource = { resourceId: number; name: string; resourceTypeRel?: { name: string } };
type ResourceType = { typeId: number; name: string };

export default function ResourcesDemo() {
  const [items, setItems] = useState<Resource[]>([]);
  const [types, setTypes] = useState<ResourceType[]>([]);
  const [name, setName] = useState("");
  const [resourceTypeId, setResourceTypeId] = useState("");
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");

  async function refresh() {
    const [resources, resourceTypes] = await Promise.all([
      apiJson("/api/resources"),
      apiJson("/api/resource-types"),
    ]);
    setItems(resources);
    setTypes(resourceTypes);
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)));
  }, []);

  return (
    <section className="space-y-6">
      <h1 className="text-2xl font-bold">Resources</h1>
      <p className="text-xs text-gray-500">Create a resource type first if the dropdown is empty.</p>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form
        className="flex flex-col gap-2 max-w-md"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await apiJson("/api/resources", "POST", {
              name,
              resourceTypeId: Number(resourceTypeId),
            });
            setName("");
            await refresh();
          } catch (err) {
            setError(String(err));
          }
        }}
      >
        <input className="border p-2 rounded text-sm" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <select className="border p-2 rounded text-sm" value={resourceTypeId} onChange={(e) => setResourceTypeId(e.target.value)} required>
          <option value="">Type...</option>
          {types.map((t) => (
            <option key={t.typeId} value={t.typeId}>{t.name}</option>
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
            await apiJson(`/api/resources/${editId}`, "PATCH", { name });
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
        {items.map((r) => (
          <li key={r.resourceId} className="flex justify-between bg-gray-50 border border-gray-200 p-2 rounded text-sm text-gray-900">
            <span>#{r.resourceId} {r.name} ({r.resourceTypeRel?.name})</span>
            <button
              className="text-red-500 text-xs font-bold uppercase"
              onClick={async () => {
                setError("");
                try {
                  await apiJson(`/api/resources/${r.resourceId}`, "DELETE");
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
