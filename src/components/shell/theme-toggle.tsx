"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    // Reads the class the inline script in the document head already set
    // before hydration. Must run after mount — the class lives on `document`,
    // which does not exist on the server — so the icon renders blank for one
    // frame rather than guessing and risking a flash of the wrong theme.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      window.localStorage.setItem("goalpath-theme", next ? "dark" : "light");
    } catch {
      // Ignore — the toggle still works for this page view.
    }
    setDark(next);
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark === null ? null : dark ? <Sun /> : <Moon />}
    </Button>
  );
}
