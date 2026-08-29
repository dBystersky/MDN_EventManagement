import { DemoNav } from "./nav";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      <DemoNav />
      <main className="mx-auto max-w-3xl p-8">{children}</main>
    </div>
  );
}
