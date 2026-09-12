import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/locations", label: "Locations" },
  { href: "/events", label: "Events" },
  { href: "/tasks", label: "Tasks" },
  { href: "/resource-types", label: "Resource types" },
  { href: "/resources", label: "Resources" },
  { href: "/allocations", label: "Allocations" },
];

const navLinkClass = cn(
  buttonVariants({ variant: "ghost" }),
  "text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground",
);

export function CrudNav() {
  return (
    <header className="bg-primary text-primary-foreground">
      <nav className="mx-auto flex max-w-3xl flex-wrap items-center gap-1 px-8 py-3 text-sm">
        <Link href="/events" className={cn(navLinkClass, "font-bold")}>
          Manage
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
