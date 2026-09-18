"use client";

import { LogOutIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <button
      onClick={handleLogout}
      className={cn(
        buttonVariants({ variant: "ghost", size: "sm" }),
        "text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground gap-1.5",
        className,
      )}
    >
      <LogOutIcon className="h-4 w-4" />
      Log out
    </button>
  );
}
