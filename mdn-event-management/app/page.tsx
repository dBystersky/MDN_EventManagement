import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarIcon, MapPinIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthSession } from "@/lib/auth";
import { NeuralNetwork } from "./neural-network";
import { PublicCalendar, type PublicEvent } from "./public-calendar";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UPCOMING_LIMIT = 6;

// Public landing page. Queries only the few fields shown below so nothing
// internal (budgets, managers, tasks, resources) reaches unauthenticated visitors.
export default async function Home() {
  const session = await getAuthSession();
  if (session && session.role !== "Guest") redirect("/events");

  const allEvents = await prisma.event.findMany({
    orderBy: { date: "asc" },
    select: {
      eventId: true,
      name: true,
      description: true,
      date: true,
      location: { select: { name: true } },
    },
  });

  const now = new Date();
  const events = allEvents.filter((e) => e.date >= now).slice(0, UPCOMING_LIMIT);
  const calendarEvents: PublicEvent[] = allEvents.map((e) => ({
    eventId: e.eventId,
    name: e.name,
    description: e.description,
    date: e.date.toISOString(),
    location: e.location?.name ?? null,
  }));

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="relative overflow-hidden bg-linear-to-b from-[#6f66f8] to-[#82b1ff] text-white">
        <NeuralNetwork className="pointer-events-none absolute inset-0 size-full text-white" />
        <div className="relative mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2.5">
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
          <Link
            href={session ? "/calendar" : "/login"}
            className={cn(buttonVariants({ variant: "secondary" }), "rounded-full px-5")}
          >
            {session ? "Open calendar" : "Member login"}
          </Link>
        </div>

        <div className="relative mx-auto max-w-5xl px-6 pt-16 pb-32 text-center md:pt-24 md:pb-44">
          <h1 className="font-heading text-4xl font-medium tracking-tight md:text-6xl">
            What&apos;s on at Monash DeepNeuron
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-white/85 md:text-lg">
            Workshops, talks and community events from our team. Take a look at what&apos;s coming
            up.
          </p>
          <a
            href="#upcoming"
            className={cn(
              buttonVariants({ variant: "secondary", size: "lg" }),
              "mt-8 rounded-full px-8",
            )}
          >
            See upcoming events
          </a>
        </div>

        <svg
          aria-hidden="true"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 w-full fill-background md:h-24"
        >
          <path d="M0 80 C 240 30, 480 20, 720 50 S 1200 110, 1440 70 L1440 120 L0 120 Z" />
        </svg>
      </header>

      <main id="upcoming" className="mx-auto max-w-5xl scroll-mt-4 px-6 py-16">
        <h2 className="font-heading text-2xl font-medium tracking-tight md:text-3xl">
          Upcoming events
        </h2>

        {events.length === 0 ? (
          <p className="mt-6 text-muted-foreground">
            Nothing scheduled right now — check back soon.
          </p>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.eventId}>
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <CalendarIcon className="size-4" />
                      {event.date.toLocaleDateString("en-AU", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      <span className="text-muted-foreground">
                        {event.date.toLocaleTimeString("en-AU", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <CardTitle className="text-lg">{event.name}</CardTitle>
                    {event.description && (
                      <CardDescription className="line-clamp-3">
                        {event.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  {event.location && (
                    <CardContent className="mt-auto flex items-center gap-1.5 text-sm text-muted-foreground">
                      <MapPinIcon className="size-4" />
                      {event.location.name}
                    </CardContent>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}

        <h2
          id="calendar"
          className="mt-20 scroll-mt-4 font-heading text-2xl font-medium tracking-tight md:text-3xl"
        >
          Calendar
        </h2>
        <div className="mt-8">
          <PublicCalendar events={calendarEvents} />
        </div>
      </main>

      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Monash DeepNeuron
      </footer>
    </div>
  );
}
