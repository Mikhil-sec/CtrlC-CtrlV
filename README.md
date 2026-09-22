# GoalPath

Work out whether your financial goals are reachable, and what it would take to
get there.

You enter what you earn and what you spend. GoalPath projects the months ahead,
funds your goals from what is left over, and tells you which ones land on time.
Then you can change something — cut a category, take a raise, move a deadline —
and watch the dates move.

Built for Mauritius: amounts are in rupees, and the statutory end-of-year bonus
is modelled where it actually lands rather than averaged across the year, which
is often the difference between reaching a December goal and missing it.

## What makes it different from a savings calculator

**Goals compete.** A calculator handles one goal at a time. Real budgets do not
work that way, so every goal here draws on the same monthly surplus. The app
shows what each goal costs the others, and lets you change how the surplus is
divided.

**Answers are probabilities.** Spending varies and freelance work dries up.
Rather than naming one date and implying a confidence the inputs do not support,
GoalPath simulates many possible futures and reports how many of them get there
in time.

**The language model never does arithmetic.** It has exactly one job: turning a
sentence like _"what if I spend a third less on eating out"_ into a small,
strictly typed set of adjustments. Those go through validation and into a pure
TypeScript engine, which produces every figure on screen. If the model returns
anything outside that set it is rejected, and a rule-based parser handles the
question instead. No figure shown to a user was written by a model.

## Running it

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

An API key for a language model is optional. Without one, questions are read by
a keyword parser instead and every feature still works — see
`src/lib/ai/fallback.ts`.

### Commands

| Command             | What it does                      |
| ------------------- | --------------------------------- |
| `npm run dev`       | Development server                |
| `npm test`          | Engine unit tests                 |
| `npm run typecheck` | TypeScript, no emit               |
| `npm run lint`      | ESLint                            |
| `npm run format`    | Prettier, in place                |
| `npm run db:push`   | Apply the schema to the database  |
| `npm run db:seed`   | Reset and reseed the demo account |
| `npm run db:studio` | Browse the database               |

## How the code is laid out

```
src/
  lib/
    contract/     Domain types, validation schemas, demo fixtures
    engine/       The projection. Pure functions, no I/O, unit tested
    ai/           Provider abstraction, prompts, and the rule-based fallback
    db/           Prisma queries, all scoped by user id
    auth/         Session handling and ownership checks
  app/
    api/          Route handlers
    (app)/        The signed-in pages
prisma/           Schema and seed
docs/             Design notes
```

The engine has no dependencies beyond the domain types, which is what lets the
same code run in the browser for instant feedback on a slider and on the server
when a plan is saved. There is no second implementation to keep in step.

`src/lib/contract/` is the shared contract every other module is written
against. Changes there affect everyone, so they get agreed before they get made.

More on the reasoning behind all of this in [docs/architecture.md](docs/architecture.md).
