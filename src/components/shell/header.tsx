"use client";

import * as React from "react";
import Link from "next/link";
import { CircleHelp, Menu, Wallet, X } from "lucide-react";
import { NavLinks } from "@/components/shell/nav-links";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding/use-onboarding";

export function Header() {
  const [open, setOpen] = React.useState(false);
  const { reopen } = useOnboarding();

  return (
    <header className="border-border bg-background/85 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="bg-accent text-accent-foreground flex size-8 items-center justify-center rounded-lg">
            <Wallet className="size-4" />
          </span>
          GoalPath
        </Link>

        <NavLinks className="hidden items-center gap-1 md:flex" />

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="How this works"
            onClick={reopen}
          >
            <CircleHelp className="size-4" />
          </Button>
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-border border-t px-4 py-3 md:hidden">
          <NavLinks className="flex flex-col gap-1" onNavigate={() => setOpen(false)} />
        </div>
      )}
    </header>
  );
}
