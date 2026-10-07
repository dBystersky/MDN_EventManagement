import { requireNonGuestPage } from "@/lib/auth";
import LocationsDemo from "./locations-client";

export default async function LocationsPage() {
  await requireNonGuestPage();
  return <LocationsDemo />;
}
