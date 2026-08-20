import { DemoNav } from "./nav";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen p-8 font-sans max-w-3xl mx-auto bg-white text-gray-900">
      <DemoNav />
      {children}
    </main>
  );
}
