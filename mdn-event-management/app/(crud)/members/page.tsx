import { requireNonGuestPage } from "@/lib/auth";
import MembersDemo from "./members-client";

export default async function MembersPage() {
  await requireNonGuestPage();
  return <MembersDemo />;
}
