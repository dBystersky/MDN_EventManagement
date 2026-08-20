import { prisma } from "@/lib/prisma";
import { taskInclude } from "@/lib/tasks";
import { createTaskAction, deleteTaskAction, updateTaskAction } from "./actions";

export const dynamic = "force-dynamic";

function toDateTimeLocal(value: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

async function getTestData() {
  const [tasks, members] = await Promise.all([
    prisma.task.findMany({
      include: taskInclude,
      orderBy: { deadline: "asc" },
    }),
    prisma.member.findMany({
      orderBy: { name: "asc" },
      select: { memberId: true, name: true, email: true, role: true },
    }),
  ]);

  return { tasks, members };
}

export default async function TestTasksPage() {
  const data = await getTestData();

  return (
    <main className="p-8 font-sans space-y-10">
      <h1 className="text-3xl font-bold border-b pb-2 text-gray-800">
        Task CRUD Test Page
      </h1>

      <section className="border p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-blue-600 mb-4">1. Create Task</h2>

        <form action={createTaskAction} className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <input
            name="name"
            placeholder="Task name..."
            className="border p-2 rounded text-sm"
            required
          />
          <input
            name="deadline"
            type="datetime-local"
            className="border p-2 rounded text-sm"
            required
          />
          <textarea
            name="description"
            placeholder="Description (optional)"
            className="border p-2 rounded text-sm md:col-span-2"
            rows={3}
          />
          <fieldset className="md:col-span-2 border rounded p-3">
            <legend className="text-xs font-bold uppercase text-gray-500 px-1">
              Task managers
            </legend>
            {data.members.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {data.members.map((m) => (
                  <label key={m.memberId} className="text-sm flex items-center gap-2">
                    <input type="checkbox" name="memberIds" value={m.memberId} />
                    {m.name} ({m.role})
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 italic text-sm">
                No members yet — create a task without assignees, or add members first.
              </p>
            )}
          </fieldset>
          <button
            type="submit"
            className="bg-blue-600 text-white py-2 rounded text-sm font-bold md:col-span-2"
          >
            Add Task
          </button>
        </form>
      </section>

      <section className="border p-6 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-green-600 mb-4">2. Tasks</h2>

        {data.tasks.length > 0 ? (
          <div className="space-y-6">
            {data.tasks.map((t) => {
              const assigned = new Set(t.taskManagers.map((tm) => tm.memberId));
              return (
                <article key={t.taskId} className="border rounded-lg p-4 bg-gray-50 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{t.name}</h3>
                      <p className="text-sm text-gray-600">
                        Deadline: {t.deadline.toLocaleString()} · Bookable #{t.bookableId}
                      </p>
                      {t.description ? (
                        <p className="text-sm text-gray-700 mt-1">{t.description}</p>
                      ) : (
                        <p className="text-sm text-gray-400 italic mt-1">No description</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        Managers:{" "}
                        {t.taskManagers.length > 0
                          ? t.taskManagers.map((tm) => tm.member.name).join(", ")
                          : "none"}
                      </p>
                    </div>
                    <form
                      action={async () => {
                        "use server";
                        await deleteTaskAction(t.taskId);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-red-500 hover:text-red-700 text-xs font-bold uppercase"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                  <form action={updateTaskAction} className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input type="hidden" name="taskId" value={t.taskId} />
                    <input
                      name="name"
                      defaultValue={t.name}
                      className="border p-2 rounded text-sm"
                      required
                    />
                    <input
                      name="deadline"
                      type="datetime-local"
                      defaultValue={toDateTimeLocal(t.deadline)}
                      className="border p-2 rounded text-sm"
                      required
                    />
                    <textarea
                      name="description"
                      defaultValue={t.description ?? ""}
                      className="border p-2 rounded text-sm md:col-span-2"
                      rows={2}
                    />
                    <fieldset className="md:col-span-2 border rounded p-2">
                      <legend className="text-xs font-bold uppercase text-gray-500 px-1">
                        Reassign managers
                      </legend>
                      <div className="flex flex-wrap gap-3">
                        {data.members.map((m) => (
                          <label key={m.memberId} className="text-sm flex items-center gap-2">
                            <input
                              type="checkbox"
                              name="memberIds"
                              value={m.memberId}
                              defaultChecked={assigned.has(m.memberId)}
                            />
                            {m.name}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <button
                      type="submit"
                      className="bg-green-600 text-white py-2 rounded text-sm font-bold md:col-span-2"
                    >
                      Save changes
                    </button>
                  </form>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-500 italic">No tasks found.</p>
        )}
      </section>
    </main>
  );
}
