"use client";

import * as React from "react";
import Link from "next/link";
import { HelpCircle, LogOut, Menu, Wallet, X } from "lucide-react";
import { NavLinks } from "@/components/shell/nav-links";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOutAction } from "@/lib/auth/actions";
import { useOnboarding } from "@/lib/store/onboarding";

export interface HeaderUser {
  name: string | null;
  image: string | null;
}

export function Header({ user }: { user: HeaderUser | null }) {
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
          {user && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="How this works"
              onClick={reopen}
            >
              <HelpCircle className="size-4" />
            </Button>
          )}
          <ThemeToggle />
          {user ? (
            <form action={signOutAction}>
              <Button variant="ghost" size="sm" type="submit">
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </Button>
            </form>
          ) : (
            <Link
              href="/sign-in"
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Sign in
            </Link>
          )}
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
