"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { addMonths, formatMoney, toRupees } from "@/lib/engine";
import type { Minor, MonthKey } from "@/lib/contract/types";

interface Point {
  month: MonthKey;
  balance: number;
}

export function GoalBalanceChart({
  balances,
  startMonth,
  targetMinor,
  targetDate,
}: {
  balances: Minor[];
  startMonth: MonthKey;
  targetMinor: Minor;
  targetDate: string;
}) {
  const data: Point[] = balances.map((balance, index) => ({
    month: addMonths(startMonth, index),
    balance: toRupees(balance),
  }));

  const targetMonth = targetDate.slice(0, 7);
  const targetIndex = data.findIndex((point) => point.month >= targetMonth);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={40}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted)" }}
            tickLine={false}
            axisLine={false}
            width={60}
            tickFormatter={(v: number) => formatMoney(v * 100)}
          />
          <Tooltip
            formatter={(value) => formatMoney(Math.round(Number(value) * 100))}
            contentStyle={{
              background: "var(--surface-raised)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          <ReferenceLine
            y={toRupees(targetMinor)}
            stroke="var(--accent)"
            strokeDasharray="4 4"
            label={{
              value: "Target",
              position: "insideTopRight",
              fill: "var(--accent)",
              fontSize: 11,
            }}
          />
          {targetIndex >= 0 && (
            <ReferenceLine
              x={data[targetIndex]?.month}
              stroke="var(--muted)"
              strokeDasharray="4 4"
              label={{
                value: "Target date",
                position: "insideTop",
                fill: "var(--muted)",
                fontSize: 11,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="balance"
            stroke="var(--accent)"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
