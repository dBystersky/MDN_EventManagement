import { ResourceTypeTag } from "@/components/ui/ResourceTypeTag";
import { prisma } from "@/lib/prisma";
import { createResourceType, deleteResourceType } from "./actions";

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
      <section className="border p-6 rounded-lg bg-white shadow-sm">
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
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition"
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


      {/* 2. Resources */}
      <section>
        <h2 className="text-xl font				semibold text-green-600">2. Resources</h2>
        <ul className="list-disc ml-5 mt-2 text-gray-700">
          {data.resources.length > 0 ? (
            data.resources.map((r) => (
              <li key={r.resourceId} className="flex items-center gap-2">
                {r.name}
                <ResourceTypeTag name={r.resourceTypeRel.name} />
              </li>
            ))
          ) : (
            <p className="text-gray-500 italic">No resources found.</p>
          )}
        </ul>
      </section>

      {/* 3. Locations */}
      <section>
        <h2 className="text-xl font-semibold text-purple-600">3. Locations</h2>
        <ul className="list-disc ml-5 mt-2 text-gray-700">
          {data.locations.length > 0 ? (
            data.locations.map((l) => (
              <li key={l.locationId}>{l.name}</li>
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
            <tbody className="bg-white divide-y divide-gray-200">
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