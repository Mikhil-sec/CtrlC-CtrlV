"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      description="This screen hit a snag rendering your plan. Your data is safe — try again."
      action={
        <Button variant="outline" size="sm" onClick={reset}>
          Try again
        </Button>
      }
    />
  );
}
