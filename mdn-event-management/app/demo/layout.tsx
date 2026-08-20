import { DemoNav } from "./nav";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="p-8 font-sans max-w-3xl mx-auto">
      <DemoNav />
      {children}
    </main>
  );
}
