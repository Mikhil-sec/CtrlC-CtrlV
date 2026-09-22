"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, Wallet, X } from "lucide-react";
import { NavLinks } from "@/components/shell/nav-links";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button } from "@/components/ui/button";

export function Header() {
  const [open, setOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Wallet className="size-4" />
          </span>
          GoalPath
        </Link>

        <NavLinks className="hidden items-center gap-1 md:flex" />

        <div className="flex items-center gap-1">
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
        <div className="border-t border-border px-4 py-3 md:hidden">
          <NavLinks
            className="flex flex-col gap-1"
            onNavigate={() => setOpen(false)}
          />
        </div>
      )}
    </header>
  );
}
