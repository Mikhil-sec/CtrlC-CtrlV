import Link from "next/link";
// The installed lucide-react version dropped brand/logo icons (Github
// included), so GitBranch stands in as a generic version-control mark.
import { GitBranch as Github, Wallet } from "lucide-react";
import { signIn } from "@/auth";

export default function SignInPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6 py-20">
      <Link href="/" className="flex items-center gap-2 self-center font-semibold">
        <span className="bg-accent text-accent-foreground flex size-8 items-center justify-center rounded-lg">
          <Wallet className="size-4" />
        </span>
        GoalPath
      </Link>

      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
        <p className="text-muted text-sm">
          Your own plan is saved to your account. Prefer to look around first?{" "}
          <Link href="/dashboard" className="text-accent font-medium hover:underline">
            Try the demo
          </Link>
          .
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await signIn("github", { redirectTo: "/dashboard" });
        }}
      >
        <button
          type="submit"
          className="bg-accent text-accent-foreground flex w-full items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          <Github className="size-4" />
          Continue with GitHub
        </button>
      </form>
    </main>
  );
}
