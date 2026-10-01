import { requireNonGuestPage } from "@/lib/auth";
import Events from "./events";

export default async function EventsPage() {
  await requireNonGuestPage();
  return <Events />;
}
