import { CrudNav } from "./nav";

export default function CrudLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <CrudNav />
      <main className="mx-auto max-w-3xl p-8">{children}</main>
    </div>
  );
}
