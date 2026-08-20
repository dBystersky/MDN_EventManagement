import Link from "next/link";

const LINKS = [
  { href: "/demo/locations", label: "Locations" },
  { href: "/demo/events", label: "Events" },
  { href: "/demo/tasks", label: "Tasks" },
  { href: "/demo/resource-types", label: "Resource types" },
  { href: "/demo/resources", label: "Resources" },
  { href: "/demo/allocations", label: "Allocations" },
];

export function DemoNav() {
  return (
    <nav className="flex flex-wrap gap-3 border-b pb-3 mb-6 text-sm">
      <Link href="/demo" className="font-bold text-gray-800">
        Demo
      </Link>
      {LINKS.map((l) => (
        <Link key={l.href} href={l.href} className="text-blue-600 hover:underline">
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
