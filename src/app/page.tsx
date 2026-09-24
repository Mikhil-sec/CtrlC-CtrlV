import Link from "next/link";

const pillars = [
  {
    title: "Every goal, competing for one surplus",
    body: "Most planners take one goal at a time. Yours do not arrive one at a time, so GoalPath funds them against the same monthly surplus and shows you what that costs each of them.",
  },
  {
    title: "A likelihood, not a false promise",
    body: "Income moves and bills surprise you. Instead of naming a single date, GoalPath simulates a thousand possible years and tells you how many of them reach your goal in time.",
  },
  {
    title: "Ask what it would take",
    body: "Tell it “I want to go to Japan by December” and the sandbox rearranges itself to show you: the smallest spending cut, raise or reshuffle that gets you there, each one checked by the same engine that works out every other date.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-12 px-6 py-20">
      <header className="flex flex-col gap-5">
        <p className="text-accent text-sm font-medium tracking-wide uppercase">
          GoalPath
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Can you afford the things you are saving for?
        </h1>
        <p className="text-muted max-w-2xl text-lg text-pretty">
          Put in what you earn and what you spend. GoalPath works out which of your
          goals are reachable, which are not, and exactly what would have to change for
          that answer to be different.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/dashboard"
            className="bg-accent text-accent-foreground rounded-lg px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
          >
            Open the demo
          </Link>
          <Link
            href="/sign-in"
            className="border-border hover:bg-surface rounded-lg border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="border-border grid gap-8 border-t pt-10">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">{pillar.title}</h2>
            <p className="text-muted text-sm/relaxed">{pillar.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
