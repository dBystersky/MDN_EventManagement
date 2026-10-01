import { requireNonGuestPage } from "@/lib/auth";
import AllocationsDemo from "./allocations-client";

export default async function AllocationsPage() {
  await requireNonGuestPage();
  return <AllocationsDemo />;
}
