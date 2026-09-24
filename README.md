# GoalPath

**Live app: [goalpath-rho.vercel.app](https://goalpath-rho.vercel.app)** — open the
demo without signing in, or sign in with GitHub to plan with your own figures.

Work out whether your financial goals are reachable, and what it would take to
get there.

You enter what you earn and what you spend. GoalPath projects the months ahead,
funds your goals from what is left over, and tells you which ones land on time
and how likely that really is. Then you can change something — cut a category,
take a raise, move a deadline — and watch the dates move. Or just ask:
_"I want to go to Japan by the end of 2026"_, and the sandbox rearranges itself
to show you what it would take.

Built for Mauritius: amounts are in rupees, and the statutory end-of-year bonus
is modelled where it actually lands rather than averaged across the year, which
is often the difference between reaching a December goal and missing it.

## Try it in two minutes

1. Open the [dashboard](https://goalpath-rho.vercel.app/dashboard). Three goals
   share one surplus; each card shows when it is funded and its odds of making
   the deadline across 1,000 simulated futures.
2. Go to the [sandbox](https://goalpath-rho.vercel.app/sandbox) and ask the
   assistant one of these:
   - _Can I still have the new laptop by March 2027?_
   - _I want to go to Japan at the end of 2026_
   - _What if I cut eating out by a third?_
   - _Who is Donald Trump?_ (it will politely stay on topic)
3. Watch the sliders glide to the answer, pick a different option from the
   list, or drag anything yourself. Ctrl+Z undoes, and nothing is saved to your
   plan until you decide it should be.
4. Open [Tradeoffs](https://goalpath-rho.vercel.app/contention) to see what
   running the goals together costs each one.

## What makes it different from a savings calculator

**Goals compete.** A calculator handles one goal at a time. Real budgets do not
work that way, so every goal here draws on the same monthly surplus. The app
shows what each goal costs the others, and lets you change how the surplus is
divided.

**It works backwards from what you want.** Ask for a goal by a date and GoalPath
searches for the smallest change that gets there — trimming optional spending, a
raise, putting that goal first, or a fixed amount more each month — and names
the price of each, such as _"Emergency fund waits 10 more months"_. Every option
is run through the projection before it is shown, so none of them is an
estimate.

**Answers are probabilities.** Spending varies and freelance work dries up.
Rather than naming one date and implying a confidence the inputs do not support,
GoalPath simulates 1,000 possible futures and reports how many of them get there
in time, along with the range of months most of them land in.

**The language model never does arithmetic.** Its job is to understand the
message: a change to try, a goal to work back from, a question about the plan,
or something off-topic to decline. A change is expressed as a small, strictly
typed set of adjustments that go through validation and into a pure TypeScript
engine, which produces every figure on screen. If the model returns anything
outside that set, or refers to an item the user does not have, it is rejected
and a rule-based reader handles the message instead. No figure shown to a user
was written by a model.

## Who it is for

Someone earning Rs 25,000–40,000 a month has a thin surplus and usually more
than one thing they are saving for. That is exactly the situation where the
order you fund things in changes the outcome by months, and exactly the
situation a single-goal calculator cannot describe. Above a certain income the
question stops mattering. This is built for the income where it matters most.

The useful answer is often "no". A tool that says _this is not reachable by
June, and here is the earliest it is_ helps someone avoid borrowing to close a
gap they did not know they had. Showing a shortfall before the purchase is more
valuable than encouragement after it.

Each insight ties a concept — an emergency fund, opportunity cost, income that
arrives in lumps — to a figure from the user's own budget, because generic
advice gets ignored and specific advice does not.

It takes no bank credentials and moves no money, which keeps it something a
bank, credit union or employer could offer as an advisory tool without the
regulatory weight of a payments product. The engine runs in the browser, so the
cost of serving another user is close to nothing.

**Known limits.** Manual entry is friction; `src/lib/sources/types.ts` defines
the interface a bank feed would implement. Mauritian rupees only. Income is
entered as take-home, so there is no tax modelling.

## Security and abuse protection

- **Your data is yours.** Sign-in is GitHub OAuth (no passwords stored), sessions
  live in the database, and every query is scoped by user id in the query
  itself. The demo account is read-only.
- **The AI key is protected.** It lives only on the server. The assistant is
  rate limited per account, per address and per anonymous visitor, with limits
  held in Postgres so they apply across every serverless instance. A global
  daily budget caps what the key can be made to spend; past it, questions are
  still answered by the rule-based reader.
- **Hardened by default.** Cross-site writes are refused, writes are rate
  limited, request bodies and uploads are size-capped, API responses are never
  cached, and a strict Content Security Policy stops the page from sending data
  anywhere but its own origin.

More detail in [docs/architecture.md](docs/architecture.md#security).

## Running it locally

Requires Node 24 and a PostgreSQL database. The free tier of
[Neon](https://neon.tech) or [Supabase](https://supabase.com) is plenty.

```bash
npm install
cp .env.example .env    # then fill it in
npm run db:push         # create the tables
npm run db:seed         # load the demo account
npm run dev
```

The app runs at `http://localhost:3000`. The demo account is readable without
signing in, so you can see the whole thing working before setting up GitHub
OAuth.

An API key for a language model is optional. Without one, messages are read by
a keyword parser instead and every feature still works — see
`src/lib/ai/fallback.ts`.

### Commands

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Development server                  |
| `npm test`          | Engine, assistant and sandbox tests |
| `npm run typecheck` | TypeScript, no emit                 |
| `npm run lint`      | ESLint                              |
| `npm run format`    | Prettier, in place                  |
| `npm run db:push`   | Apply the schema to the database    |
| `npm run db:seed`   | Reset and reseed the demo account   |
| `npm run db:studio` | Browse the database                 |

## How the code is laid out

```
src/
  lib/
    contract/     Domain types, validation schemas, demo fixtures
    engine/       The projection, simulation and goal solver. Pure, unit tested
    ai/           Provider abstraction, prompts, and the rule-based fallback
    sandbox/      Translating between scenarios and the sandbox controls
    db/           Prisma queries, all scoped by user id
    auth/         Session handling and ownership checks
    rate-limit.ts Shared, database-backed rate limits
  app/
    api/          Route handlers
    (app)/        The app's pages
prisma/           Schema and seed
docs/             Design notes
```

The engine has no dependencies beyond the domain types, which is what lets the
same code run in the browser for instant feedback on a slider and on the server
when the assistant answers. There is no second implementation to keep in step.

`src/lib/contract/` is the shared contract every other module is written
against. Changes there affect everyone, so they get agreed before they get made.

More on the reasoning behind all of this in [docs/architecture.md](docs/architecture.md).
