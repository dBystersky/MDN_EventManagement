import { redirect } from "next/navigation";

/** Resource types are managed on the Resources page now; keep old links working. */
export default function ResourceTypesPage() {
  redirect("/resources");
}
