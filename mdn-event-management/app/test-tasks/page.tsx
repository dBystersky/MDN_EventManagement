import { prisma } from "@/lib/prisma";
import { createTaskAction, deleteTaskAction } from "./actions";

export const dynamic = "force-dynamic";

async function getTestData() {
  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      include: {
        bookable: true,
        taskManagers: { include: { member: true } },
      },
      orderBy: { deadline: "asc" },
    }),
    prisma.member.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

  return { tasks, members };
}

export default async function TestTasksPage() {
  const data = await getTestData();

  return (
    <main className="p-8 font-sans space-y-10">
      <h1 className="text-3xl font-bold border-b pb-2 text-gray-800">
        Database Schema Test Page
      </h1>

      <section className="border p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-blue-600 mb-4">1. Tasks</h2>

        <form action={createTaskAction} className="flex flex-col gap-2 mb-6 max-w-md">
          <input
            name="name"
            placeholder="Task Name..."
            className="border p-2 rounded text-sm"
            required
          />
          <input
            name="description"
            placeholder="Description..."
            className="border p-2 rounded text-sm"
          />
          <input
            name="deadline"
            type="datetime-local"
            className="border p-2 rounded text-sm"
            required
          />
          <select name="memberIds" className="border p-2 rounded text-sm" multiple>
            {data.members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.name}
              </option>
            ))}
          </select>
          <button type="submit" className="bg-blue-600 text-white py-2 rounded text-sm font-bold">
            Add Task
          </button>
        </form>

        <ul className="space-y-3">
          {data.tasks.length > 0 ? (
            data.tasks.map((t) => (
              <li key={t.taskId} className="flex items-center justify-between bg-gray-50 p-2 rounded border">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-gray-500">
                    {t.deadline.toLocaleString()} · bookable #{t.bookableId}
                  </span>
                </div>

                <form action={async () => {
                  "use server";
                  await deleteTaskAction(t.taskId);
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
            <p className="text-gray-500 italic">No tasks found.</p>
          )}
        </ul>
      </section>
    </main>
  );
}
