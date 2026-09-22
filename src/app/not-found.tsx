import Link from "next/link";
import { Compass } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="bg-accent-soft text-accent rounded-full p-3">
        <Compass className="size-6" />
      </div>
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="text-muted max-w-sm text-sm">
        That page does not exist, or has moved.
      </p>
      <Link href="/dashboard" className={buttonVariants()}>
        Back to dashboard
      </Link>
    </main>
  );
}
