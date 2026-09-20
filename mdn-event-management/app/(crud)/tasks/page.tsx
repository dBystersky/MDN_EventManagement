import { requireNonGuestPage } from "@/lib/auth";
import TasksDemo from "./tasks-client";

export default async function TasksPage() {
  await requireNonGuestPage();
  return <TasksDemo />;
}
