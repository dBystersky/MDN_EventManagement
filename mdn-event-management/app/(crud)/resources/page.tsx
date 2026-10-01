import { requireNonGuestPage } from "@/lib/auth";
import ResourcesDemo from "./resources-client";

export default async function ResourcesPage() {
  await requireNonGuestPage();
  return <ResourcesDemo />;
}
