import { ResourceTypeTag } from "@/components/ui/ResourceTypeTag";
import { prisma } from "@/lib/prisma";
import { createLocation, createResource, createResourceType, deleteLocation, deleteResource, deleteResourceType } from "./actions";

async function getTestData() {
  // Fetching all required data in parallel to optimize performance
  const [resourceTypes, resources, locations, allocations] = await Promise.all([
    prisma.resourceType.findMany(),
    prisma.resource.findMany({
      include: { resourceTypeRel: true }, // Required to access the Type name for the Tag
    }),
    prisma.location.findMany(),
    prisma.resourceAllocation.findMany({
      include: {
        resource: {
          include: { resourceTypeRel: true }, // Deeply nested include for the table view
        },
      },
    }),
  ]);

  return { resourceTypes, resources, locations, allocations };
}

export default async function TestDatabasePage() {
  const data = await getTestData();

  return (
    <main className="p-8 font-sans space-y-10">
      <h1 className="text-3xl font-bold border-b pb-2 text-gray-800">
        Database Schema Test Page
      </h1>

      {/* 1. Resource Types Section */}
      <section className="border p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-blue-600 mb-4">1. Resource Types</h2>

        {/* CREATE FORM */}
        <form action={createResourceType} className="flex gap-2 mb-6">
          <input
            name="name"
            placeholder="New Type Name..."
            className="border p-2 rounded text-sm flex-grow"
            required
          />
          <button
            type="submit"
            className="text-white px-4 py-2 rounded text-sm transition"
          >
            Add Type
          </button>
        </form>

        {/* LIST WITH DELETE */}
        <ul className="space-y-3">
          {data.resourceTypes.length > 0 ? (
            data.resourceTypes.map((t) => (
              <li key={t.typeId} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                <ResourceTypeTag name={t.name} />

                {/* DELETE FORM */}
                <form action={async () => {
                  "use server"; // Inline server action for simplicity in this test
                  await deleteResourceType(t.typeId);
                }}>
                  <button
                    type="submit"
                    className="text-red-500 hover:text-red-700 text-xs font-bold uppercase"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))
          ) : (
            <p className="text-gray-500 italic">No resource types found.</p>
          )}
        </ul>
      </section>


   {/* 2. Resources Section UPDATED */}
      <section className="border p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-green-600 mb-4">2. Resources</h2>

        {/* CREATE FORM */}
        <form action={createResource} className="flex flex-col gap-2 mb-6 max-w-md">
          <input
            name="name"
            placeholder="Resource Name..."
            className="border p-2 rounded text-sm"
            required
          />
          <select name="resourceTypeId" className="border p-2 rounded text-sm" required>
            <option value="">Select Type...</option>
            {data.resourceTypes.map((t) => (
              <option key={t.typeId} value={t.typeId}>
                {t.name}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-green-600 text-white py-2 rounded text-sm font-bold">
            Add Resource
          </button>
        </form>

        {/* LIST WITH DELETE */}
        <ul className="space-y-3">
          {data.resources.length > 0 ? (
            data.resources.map((r) => (
              <li key={r.resourceId} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{r.name}</span>
                  <ResourceTypeTag name={r.resourceTypeRel.name} />
                </div>

                {/* DELETE FORM */}
                <form action={async () => {
                  "use server";
                  await deleteResource(r.resourceId);
                }}>
                  <button
                    type="submit"
                    className="text-red-500 hover:text-red-700 text-xs font-bold uppercase"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))
          ) : (
            <p className="text-gray-500 italic">No resources found.</p>
          )}
        </ul>
      </section>

  {/* 3. Locations UPDATED */}
      <section className="border p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-purple-600 mb-4">3. Locations</h2>

        {/* CREATE FORM */}
        <form action={createLocation} className="flex gap-2 mb-6 max-w-md">
          <input
            name="name"
            placeholder="New Location Name..."
            className="border p-2 rounded text-sm flex-grow"
            required
          />
          <button
            type="submit"
            className="bg-purple-600 text-white px-4 py-2 rounded text-sm font-bold transition"
          >
            Add Location
          </button>
        </form>

        {/* LIST WITH DELETE */}
        <ul className="space-y-3">
          {data.locations.length > 0 ? (
            data.locations.map((l) => (
              <li key={l.locationId} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                <span className="text-gray-700 font-medium">{l.name}</span>

                {/* DELETE FORM */}
                <form action={async () => {
                  "use server"; 
                  await deleteLocation(l.locationId);
                }}>
                  <button
                    type="submit"
                    className="text-red-500 hover:text-red-700 text-xs font-bold uppercase"
                  >
                    Delete
                  </button>
                </form>
              </li>
            ))
          ) : (
            <p className="text-gray-500 italic">No locations found.</p>
          )}
        </ul>
      </section>

      {/* 4. Resource Allocations */}
      <section>
        <h2 className="text-xl font-semibold text-red-600">4. Resource Allocations</h2>
        <div className="mt-2 overflow-x-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="p-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">Resource</th>
                <th className="p-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">Start Time</th>
                <th className="p-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">End Time</th>
                <th className="p-3 text-sm font-semibold text-gray-600 uppercase tracking-wider">Bookable ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {data.allocations.length > 0 ? (
                data.allocations.map((a) => (
                  <tr key={a.allocationId} className="hover:bg-gray-50 transition-colors">
                    <td className="p-3 text-sm text-gray-900">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium">{a.resource.name}</span>
                        <ResourceTypeTag name={a.resource.resourceTypeRel.name} />
                      </div>
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {a.startTime.toLocaleString()}
                    </td>
                    <td className="p-3 text-sm text-gray-600">
                      {a.endTime.toLocaleString()}
                    </td>
                    <td className="p-3 text-xs font-mono text-gray-400">
                      #{a.bookableId}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500 italic">
                    No allocations found in the database.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}