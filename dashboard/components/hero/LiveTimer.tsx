"use client";

import { useEffect, useState } from "react";
import { Metric } from "./Metric";
import { formatTimeSince } from "@/lib/utils";

export function LiveTimer({
  lastViolationAt,
}: {
  lastViolationAt: string | null;
}) {
  // Start with "—" on both server and client initial render to avoid mismatch.
  // After mount, compute the real value and tick every second.
  const [value, setValue] = useState("—");

  useEffect(() => {
    function update() {
      setValue(lastViolationAt ? formatTimeSince(lastViolationAt) : "—");
    }
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastViolationAt]);

  return <Metric label="Last violation" value={value} />;
}
