import { getAuthSession } from "@/lib/auth";

import { CrudNav } from "./nav";

export default async function CrudLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthSession();

  return (
    <div className="flex min-h-svh flex-col bg-background font-sans text-foreground md:flex-row">
      <CrudNav
        user={session ? { email: session.email, role: session.role } : null}
      />
      <main className="mx-auto w-full min-w-0 max-w-3xl flex-1 p-8">{children}</main>
    </div>
  );
}
