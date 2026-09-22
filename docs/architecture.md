# Design notes

Why the code is shaped the way it is.

## The central decision: the model does not calculate

A language model asked "can I afford this by June" will produce a confident
number. It will often be wrong, and there is no way to tell from looking at it.
For an app whose entire value is the trustworthiness of a figure, that is not an
acceptable failure mode.

So the work is split by what each part is actually good at:

| Step             | Who does it | What it produces                  |
| ---------------- | ----------- | --------------------------------- |
| Read the request | Model       | A list of typed adjustments       |
| Validate         | Zod         | Accept, or reject and fall back   |
| Compute          | Engine      | Every figure the user sees        |
| Describe         | Model       | Prose about figures it was handed |

The adjustment set is closed and small — ten shapes, defined as
`ScenarioAdjustment` in `src/lib/contract/types.ts`. The model picks from it and
fills in parameters. It cannot express "your laptop arrives in March" because
there is no adjustment that says that. Anything it returns that does not parse
is discarded.

When it comes to writing the explanation, the model is given the computed diff
and nothing else — not the profile, not the inputs. It cannot introduce a figure
the engine did not produce, because it was never shown one.

Each response records which path produced it (`source: "model" | "rules"`), and
the UI says so. A user should always be able to tell.

## Money is an integer

Every amount in the system is a whole number of cents, typed as `Minor`.
Floating point rupees appear in exactly two places: parsing what someone typed,
and formatting a figure for display.

This is not pedantry. `0.1 + 0.2 !== 0.3` in JavaScript, and a projection is
thousands of additions deep. In integers, a plan that adds up on screen adds up
in the database.

The one place this needs care is division — splitting a surplus across goals.
`distribute()` in `src/lib/engine/money.ts` floors each share and then hands out
the remaining cents one at a time to the largest fractional parts, so the parts
always sum exactly to the input. There is a test that checks this across a range
of awkward splits, because a cent leaking per month is a bug nobody notices
until the totals stop matching.

Database columns are 4-byte integers, which caps an amount at about Rs 21.4m.
The validation ceiling is set just below that deliberately, so an over-large
figure is rejected by validation rather than by Postgres.

## Lumpy money

Most planners reduce everything to a monthly average. That quietly misreports
what is available in any specific month, and in Mauritius it misses something
important: the statutory end-of-year bonus is a month of salary arriving in
December.

The engine distinguishes smooth cadences from lumpy ones. Weekly, fortnightly
and monthly items are averaged, because spreading them loses nothing. Quarterly
and annual items land on their `anchorMonth`. The demo profile has a bonus in
December and a car insurance premium in March, so the projection has to handle a
spike in both directions.

This is what lets the app say something genuinely useful: setting a goal date in
January rather than November can make it reachable without changing anything
else.

## The engine is pure

`src/lib/engine/` has no I/O, no database access, and no dependency beyond the
domain types. That buys three things:

- **The same code runs in both places.** Slider changes recompute in the browser
  with no round trip. Saved plans are computed on the server. There is no second
  implementation to drift.
- **It is testable without infrastructure.** The suite runs in about 300ms, with
  no database and no network.
- **The simulation is affordable.** A thousand runs over sixty months is a few
  million operations of arithmetic on plain arrays.

The simulation is seeded (`createRandom`, mulberry32) so the same plan always
produces the same answer. That matters for tests, and it matters for a demo
where a figure must not move between the rehearsal and the room.

## Security

The app holds a picture of someone's finances. It does not hold credentials or
move money, which keeps the surface small, but the data is still sensitive.

- **Sign-in is GitHub OAuth only.** No passwords are stored, reset, or leaked.
- **Sessions live in the database, not a JWT.** Signing out takes effect
  immediately rather than whenever a token happens to expire.
- **Ownership is enforced in the query, not after it.** Every query in
  `src/lib/db/` filters on `userId`. A handler that fetches a row and then checks
  the owner has already read something it had no right to.
- **Everything untrusted is validated at the edge.** Request bodies, uploaded
  CSV rows, and model output all go through `src/lib/contract/schemas.ts`.
  Nothing reaches the engine or the database without passing it.
- **Model-backed routes are rate limited**, because they draw on a shared
  free-tier quota that one person holding a button could exhaust.
- **API keys are server-side only and travel in headers**, never in a query
  string where they would land in a proxy log or a browser history.
- **Errors are generic to the client.** Validation issues are returned in full
  because they describe the caller's own request; anything unexpected is logged
  on the server and reported as a plain message.
- **The demo account is read-only**, so one visitor cannot change what the next
  one sees.

## Scalability

The honest version: this is a hackathon project, and the parts that would need
attention under load are known rather than solved.

What holds up:

- Route handlers are stateless and deploy to serverless without changes.
- The heavy computation runs client-side, so more users do not mean more server
  CPU.
- Queries are indexed on `userId`, and on `(userId, priority)` for the goal list,
  which is the only ordering the app asks for.
- The profile and its goals load in one round trip.

What would not, and what it would take:

- **Rate limiting is in-memory**, so it is per-instance. More than one instance
  needs a shared store such as Redis.
- **Model calls are uncached.** Identical questions re-ask the provider. Keying
  a cache by scenario hash would be the obvious next step.
- **The simulation is synchronous.** At a much longer horizon or a much higher
  run count it would need a web worker to keep the UI responsive.

## Things deliberately not built

- **Bank connections.** `src/lib/sources/` defines a `TransactionSource`
  interface with manual entry and CSV behind it. Plaid's sandbox would slot in
  as a third implementation. It is scaffolded rather than built because a broken
  integration is worse than an honest import button.
- **Multi-currency.** Everything is MUR. Supporting more means FX rates and a
  per-profile currency, which is a real feature rather than a formatting change.
- **Goal dependencies.** Goals compete for money but cannot require each other.
