"use client";

import { useEffect, useState } from "react";
import { Metric } from "./Metric";
import { formatTimeSince } from "@/lib/utils";

export function LiveTimer({
  lastViolationAt,
}: {
  lastViolationAt: string | null;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  void tick;
  const value = lastViolationAt ? formatTimeSince(lastViolationAt) : "—";
  return <Metric label="Last violation" value={value} />;
}
