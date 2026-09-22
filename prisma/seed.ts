/**
 * Seeds the demo account.
 *
 * The app can be opened and explored without signing in, which is how it gets
 * demonstrated and how it gets marked. That depends on this account existing,
 * so the seed is idempotent and safe to re-run.
 *
 * The figures come from `src/lib/contract/fixtures.ts`, the same ones the
 * engine tests assert against.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { demoGoals, demoProfile } from "../src/lib/contract/fixtures";
import { currentMonth } from "../src/lib/engine/calendar";

const DEMO_USER_ID = "demo-user";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env first.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main(): Promise<void> {
  const profile = demoProfile();
  // Goal dates are relative to today, so the demo never looks stale.
  const goals = demoGoals(currentMonth());

  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: { isDemo: true },
    create: {
      id: DEMO_USER_ID,
      name: "Demo account",
      isDemo: true,
    },
  });

  // Replace rather than merge, so re-running restores the known-good state.
  await prisma.goal.deleteMany({ where: { userId: DEMO_USER_ID } });
  await prisma.profile.deleteMany({ where: { userId: DEMO_USER_ID } });

  await prisma.profile.create({
    data: {
      userId: DEMO_USER_ID,
      openingBalanceMinor: profile.openingBalanceMinor,
      reserveMinor: 0,
      allocationStrategy: "priority",
      incomes: {
        create: profile.incomes.map((income) => ({
          label: income.label,
          amountMinor: income.amountMinor,
          cadence: income.cadence,
          kind: income.kind,
          anchorMonth: income.anchorMonth ?? null,
          variability: income.variability,
        })),
      },
      expenses: {
        create: profile.expenses.map((expense) => ({
          label: expense.label,
          amountMinor: expense.amountMinor,
          cadence: expense.cadence,
          category: expense.category,
          anchorMonth: expense.anchorMonth ?? null,
          essential: expense.essential,
          variability: expense.variability,
        })),
      },
    },
  });

  await prisma.goal.createMany({
    data: goals.map((goal) => ({
      userId: DEMO_USER_ID,
      name: goal.name,
      targetMinor: goal.targetMinor,
      savedMinor: goal.savedMinor,
      targetDate: new Date(goal.targetDate),
      priority: goal.priority,
      category: goal.category,
    })),
  });

  console.log(
    `Seeded the demo account: ${profile.incomes.length} income sources, ` +
      `${profile.expenses.length} expenses, ${goals.length} goals.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
