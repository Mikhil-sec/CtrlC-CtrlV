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
    title: "Suggestions you can actually run",
    body: "Advice is only useful if you can check it. Every suggestion here is a change you can apply in one click, with the new dates worked out by the same engine that produced the old ones.",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-12 px-6 py-20">
      <header className="flex flex-col gap-5">
        <p className="text-sm font-medium tracking-wide text-teal-700 uppercase dark:text-teal-400">
          GoalPath
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Can you afford the things you are saving for?
        </h1>
        <p className="max-w-2xl text-lg text-pretty text-slate-600 dark:text-slate-400">
          Put in what you earn and what you spend. GoalPath works out which of your
          goals are reachable, which are not, and exactly what would have to change for
          that answer to be different.
        </p>
        <div className="flex flex-wrap gap-3 pt-2">
          <Link
            href="/dashboard"
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          >
            Open the demo
          </Link>
          <Link
            href="/sign-in"
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="grid gap-8 border-t border-slate-200 pt-10 dark:border-slate-800">
        {pillars.map((pillar) => (
          <article key={pillar.title} className="flex flex-col gap-2">
            <h2 className="text-base font-semibold">{pillar.title}</h2>
            <p className="text-sm/relaxed text-slate-600 dark:text-slate-400">
              {pillar.body}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
