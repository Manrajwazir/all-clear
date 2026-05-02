"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartCard } from "./ChartCard";
import { formatViolationType } from "@/lib/utils";
import type { ViolationWithCamera } from "@/lib/supabase/types";

const TYPE_COLORS = [
  "var(--status-warning)",
  "var(--status-critical)",
  "var(--status-info)",
  "var(--status-resolved)",
  "var(--text-tertiary)",
];

interface Props {
  violations: ViolationWithCamera[];
}

export function ViolationCharts({ violations }: Props) {
  // Defer chart computation to client — buildHourlyData / buildByTypeData
  // use Date.now() / new Date() which causes hydration mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hourly = useMemo(
    () => (mounted ? buildHourlyData(violations) : []),
    [violations, mounted],
  );
  const byType = useMemo(
    () => (mounted ? buildByTypeData(violations) : []),
    [violations, mounted],
  );

  const todayTotal = hourly.reduce((sum, h) => sum + h.count, 0);
  const weekTotal = byType.reduce((sum, t) => sum + t.count, 0);

  return (
    <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <ChartCard
        eyebrow="Today · by hour"
        title="Violations over time"
        total={todayTotal}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={hourly} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
            <XAxis
              dataKey="hour"
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "var(--text-tertiary)",
                fontSize: 10,
                fontFamily: "var(--font-geist-mono)",
              }}
              interval={2}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{
                fill: "var(--text-tertiary)",
                fontSize: 10,
                fontFamily: "var(--font-geist-mono)",
              }}
              width={24}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-elevated)", opacity: 0.4 }}
              contentStyle={{
                background: "var(--surface-elevated)",
                border: "none",
                borderRadius: 8,
                boxShadow: "var(--shadow-elevated)",
                fontSize: 12,
                fontFamily: "var(--font-geist)",
              }}
              labelStyle={{
                color: "var(--text-secondary)",
                fontSize: 10,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
              itemStyle={{
                color: "var(--text-primary)",
                fontFamily: "var(--font-geist-mono)",
              }}
              formatter={(value: number) => [value, "Violations"]}
              labelFormatter={(label: string) => `${label}:00`}
            />
            <Bar
              dataKey="count"
              fill="var(--status-warning)"
              radius={[3, 3, 0, 0]}
              maxBarSize={18}
            />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard
        eyebrow="Last 7 days · by type"
        title="Violation breakdown"
        total={weekTotal}
      >
        {byType.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="grid grid-cols-2 gap-4 items-center h-full">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={byType}
                  dataKey="count"
                  nameKey="label"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  stroke="none"
                >
                  {byType.map((_, idx) => (
                    <Cell
                      key={idx}
                      fill={TYPE_COLORS[idx % TYPE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--surface-elevated)",
                    border: "none",
                    borderRadius: 8,
                    boxShadow: "var(--shadow-elevated)",
                    fontSize: 12,
                  }}
                  itemStyle={{
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-geist-mono)",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <ul className="space-y-3">
              {byType.map((row, idx) => (
                <li key={row.label} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{
                      background: TYPE_COLORS[idx % TYPE_COLORS.length],
                    }}
                  />
                  <span className="text-[12px] text-text-secondary uppercase tracking-[0.04em] flex-1 truncate">
                    {row.label}
                  </span>
                  <span className="font-mono tabular text-[12px] text-text-primary">
                    {row.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="h-full grid place-items-center">
      <span className="text-[12px] tracking-wider uppercase text-text-tertiary">
        No data yet
      </span>
    </div>
  );
}

function buildHourlyData(violations: ViolationWithCamera[]) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const buckets: { hour: string; count: number }[] = Array.from(
    { length: 24 },
    (_, h) => ({ hour: String(h).padStart(2, "0"), count: 0 }),
  );

  for (const v of violations) {
    const d = new Date(v.detected_at);
    if (d.getTime() < startOfDay.getTime()) continue;
    buckets[d.getHours()].count += 1;
  }
  return buckets;
}

function buildByTypeData(violations: ViolationWithCamera[]) {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const counts = new Map<string, number>();
  for (const v of violations) {
    if (new Date(v.detected_at).getTime() < cutoff) continue;
    counts.set(v.violation_type, (counts.get(v.violation_type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ label: formatViolationType(type), count }))
    .sort((a, b) => b.count - a.count);
}
