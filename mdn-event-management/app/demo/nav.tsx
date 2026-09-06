import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/demo/locations", label: "Locations" },
  { href: "/demo/events", label: "Events" },
  { href: "/demo/tasks", label: "Tasks" },
  { href: "/demo/resource-types", label: "Resource types" },
  { href: "/demo/resources", label: "Resources" },
  { href: "/demo/allocations", label: "Allocations" },
];

const navLinkClass = cn(
  buttonVariants({ variant: "ghost" }),
  "text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground",
);

export function DemoNav() {
  return (
    <header className="bg-primary text-primary-foreground">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-1 px-8 py-3 text-sm">
        <Link href="/demo" className={cn(navLinkClass, "font-bold")}>
          Demo
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={navLinkClass}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
