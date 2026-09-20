import { requireNonGuestPage } from "@/lib/auth";
import ResourceTypesDemo from "./resource-types-client";

export default async function ResourceTypesPage() {
  await requireNonGuestPage();
  return <ResourceTypesDemo />;
}
