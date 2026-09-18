"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";

const LINKS = [
  { href: "/locations", label: "Locations" },
  { href: "/events", label: "Events" },
  { href: "/tasks", label: "Tasks" },
  { href: "/resource-types", label: "Resource types" },
  { href: "/resources", label: "Resources" },
  { href: "/allocations", label: "Allocations" },
  { href: "/members", label: "Members" },
];

type CrudNavProps = {
  user: { email: string; role: string } | null;
};

export function CrudNav({ user }: CrudNavProps) {
  const pathname = usePathname();

  return (
    <aside className="flex w-full shrink-0 flex-col overflow-y-auto bg-primary px-4 py-6 text-primary-foreground md:sticky md:top-0 md:h-svh md:w-72">
      <Link href="/events" className="flex items-center gap-2.5 px-1">
        <Image
          src="/mdn_logo.webp"
          alt="Monash Deep Neuron"
          width={94}
          height={40}
          className="h-9 w-auto object-contain"
          priority
        />
        <span className="font-heading text-[0.95rem] leading-tight font-medium">
          Monash
          <br />
          DeepNeuron
        </span>
      </Link>

      {user ? (
        <div className="mt-6 flex min-w-0 items-center gap-2 px-1">
          <span className="truncate text-xs text-primary-foreground/80">{user.email}</span>
          <Badge
            variant="outline"
            className="border-primary-foreground/40 bg-primary-foreground/15 text-primary-foreground uppercase"
          >
            {user.role}
          </Badge>
        </div>
      ) : (
        <Link
          href="/login"
          className={cn(
            buttonVariants({ variant: "link", size: "xs" }),
            "mt-6 w-fit px-1 text-primary-foreground hover:text-primary-foreground/80",
          )}
        >
          Sign in
        </Link>
      )}

      <nav className="mt-8 flex flex-row flex-wrap gap-1 md:flex-col md:flex-1">
        {LINKS.map((l) => {
          const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                buttonVariants({
                  variant: "ghost",
                  size: "lg",
                }),
                "justify-start rounded-full px-4 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground",
                active && "bg-primary-foreground text-primary hover:bg-primary-foreground hover:text-primary",
              )}
            >
              {l.label}
            </Link>
          );
        })}
        {user && <LogoutButton className="ml-auto md:mt-auto md:ml-0 md:w-full md:justify-start md:rounded-full md:px-4 text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground" />}
      </nav>
    </aside>
  );
}
